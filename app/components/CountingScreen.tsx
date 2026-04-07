'use client';

import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Html5Qrcode } from 'html5-qrcode'; // CTO DOKUNUŞU: Scanner (Arayüz) değil, Ham Motoru (Html5Qrcode) çekiyoruz!

interface CountingScreenProps {
  depoName: string;
  availableDepolar: string[];
  onSwitchDepo: (depo: string) => void;
  items: any[];
  onBack: () => void;
  counts: Record<string, string>;
  setCounts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  notes: Record<string, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  waste: Record<string, string>;
  setWaste: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  skt: Record<string, string>;
  setSkt: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  units: Record<string, string>;
  setUnits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const normalizeText = (text: string) => {
  if (!text) return '';
  return text
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ş/g, 's').replace(/ş/g, 's')
    .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c')
    .toLowerCase();
};

const UNIT_OPTIONS = ['Adet', 'Kilo', 'gr', 'lt', 'ml', 'cl'];

export default function CountingScreen({
  depoName,
  availableDepolar,
  onSwitchDepo,
  items,
  onBack,
  counts,
  setCounts,
  notes,
  setNotes,
  waste,
  setWaste,
  skt,
  setSkt,
  units,
  setUnits,
}: CountingScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [recentlySavedId, setRecentlySavedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [addModalState, setAddModalState] = useState<{ isOpen: boolean, stokName: string, field: 'sayim' | 'zayi' | 'skt', currentVal: number, title: string } | null>(null);
  const [addModalInput, setAddModalInput] = useState('');

  const [isCameraOpen, setIsCameraOpen] = useState(false);

  useEffect(() => {
    setSearchQuery('');
    setSelectedCategory('Tümü');
    setExpandedItemId(null);
  }, [depoName]);

  // CTO DOKUNUŞU: Kusursuz Kamera Başlatma Mantığı
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isComponentMounted = true;

    if (isCameraOpen) {
      // 50ms gecikme ile DOM'un (reader div'inin) kesinlikle render edilmesini bekliyoruz
      setTimeout(() => {
        if (!isComponentMounted) return;

        html5QrCode = new Html5Qrcode("reader");

        html5QrCode.start(
          { facingMode: "environment" }, // Kesinlikle Arka Kamerayı Zorla
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (navigator.vibrate) navigator.vibrate(200); // Titreşim
            setSearchQuery(decodedText);
            setIsCameraOpen(false); // Başarılı okumada kamerayı kapat
          },
          (errorMessage) => {
            // Hataları görmezden gel (odaklanma sırasında sürekli hata döner, normaldir)
          }
        ).catch((err) => {
          console.error("Kamera başlatılamadı:", err);
          alert("Kamera açılamadı. Lütfen tarayıcı izinlerini kontrol edin.");
          setIsCameraOpen(false);
        });
      }, 50);
    }

    return () => {
      isComponentMounted = false;
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [isCameraOpen]);

  const categories = useMemo(() => {
    const groups = items.map((item) => item['Stok Grup']).filter(Boolean);
    return ['Tümü', ...Array.from(new Set(groups))];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const searchVal = normalizeText(searchQuery);
      const itemVal = normalizeText(item.Stok);
      const itemBarkod = item.Barkod ? String(item.Barkod).toLowerCase() : '';

      const matchesSearch = itemVal.includes(searchVal) || itemBarkod.includes(searchVal);
      const matchesCategory = selectedCategory === 'Tümü' || item['Stok Grup'] === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

  const handleCountChange = (stokName: string, value: string) => {
    setCounts((prev) => ({ ...prev, [stokName]: value.replace(/[^0-9.,]/g, '') }));
  };

  const handleWasteChange = (stokName: string, value: string) => {
    setWaste((prev) => ({ ...prev, [stokName]: value.replace(/[^0-9.,]/g, '') }));
  };

  const handleSktChange = (stokName: string, value: string) => {
    setSkt((prev) => ({ ...prev, [stokName]: value.replace(/[^0-9.,]/g, '') }));
  };

  const handleSaveAndClose = (stokName: string) => {
    setExpandedItemId(null);
    setRecentlySavedId(stokName);
    setTimeout(() => setRecentlySavedId(null), 800);
  };

  const openAddModal = (stokName: string, field: 'sayim' | 'zayi' | 'skt', currentValStr: string) => {
    const currentVal = Number((currentValStr || '0').replace(',', '.'));
    const titles = { sayim: 'Toplam Miktar', zayi: 'Zayi (Fire)', skt: 'SKT Geçmiş' };
    setAddModalState({ isOpen: true, stokName, field, currentVal, title: titles[field] });
    setAddModalInput('');
  };

  const closeAddModal = () => {
    setAddModalState(null);
    setAddModalInput('');
  };

  const handleAddSubmit = () => {
    if (!addModalState) return;
    const eklenecek = Number((addModalInput || '0').replace(',', '.'));
    if (!isNaN(eklenecek) && eklenecek > 0) {
      const yeniToplam = addModalState.currentVal + eklenecek;
      const yeniStr = yeniToplam.toString().replace('.', ',');

      if (addModalState.field === 'sayim') handleCountChange(addModalState.stokName, yeniStr);
      if (addModalState.field === 'zayi') handleWasteChange(addModalState.stokName, yeniStr);
      if (addModalState.field === 'skt') handleSktChange(addModalState.stokName, yeniStr);
    }
    closeAddModal();
  };

  const handleFinishAndSave = async () => {
    setIsSaving(true);
    try {
      const exportData = items.map((item) => {
        const cCount = counts[item.Stok];
        const cWaste = waste[item.Stok];
        const cSkt = skt[item.Stok];

        const hasC = cCount !== undefined && cCount !== '';
        const hasW = cWaste !== undefined && cWaste !== '';
        const hasS = cSkt !== undefined && cSkt !== '';

        const exp = Number((Number(item['Kalan Miktar']) || 0).toFixed(3));
        const cNum = hasC ? Number(cCount.replace(',', '.')) : 0;
        const wNum = hasW ? Number(cWaste.replace(',', '.')) : 0;
        const sNum = hasS ? Number(cSkt.replace(',', '.')) : 0;

        const diff = hasC ? Number((cNum - exp).toFixed(3)) : 0;
        const netUsable = hasC ? Number((cNum - wNum - sNum).toFixed(3)) : 0;

        let formattedDiff: string | number = '';
        if (hasC) {
          if (diff > 0) formattedDiff = `+${diff}`;
          else if (diff < 0) formattedDiff = diff;
          else formattedDiff = 0;
        }

        return {
          Depolar: item.Depolar,
          'Stok Grup': item['Stok Grup'],
          Stok: item.Stok,
          Barkod: item.Barkod || '',
          Birim: units[item.Stok] || item.Birim,
          'Kalan Miktar': Math.abs(exp) < 0.0001 ? 0 : exp,
          'Sayım Miktarı': hasC ? cNum : '',
          'Fark Miktarı': formattedDiff,
          Zayi: hasW ? wNum : '',
          'SKT Geçmiş': hasS ? sNum : '',
          'Net Kullanılabilir': hasC ? netUsable : '',
          'Sayım Notu': notes[item.Stok] || '',
        };
      });

      await addDoc(collection(db, 'sayimlar'), {
        depoAdi: depoName,
        sayimiYapan: auth.currentUser?.email,
        tarih: serverTimestamp(),
        veriler: exportData,
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sayım Sonucu');
      XLSX.writeFile(wb, `${depoName.replace(/\s+/g, '_')}_Sonuc.xlsx`);

      alert(`✅ Buluta kaydedildi ve Excel indirildi.`);
      onBack();
    } catch (e) {
      alert('❌ Hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen flex flex-col relative pb-24">
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10">
        <div className="flex justify-between items-center mb-4">
          <button onClick={onBack} className="text-blue-600 font-bold hover:underline px-2 py-1">
            ← Geri
          </button>
          <div className="flex bg-gray-100 rounded-lg px-2 py-1 border border-gray-200">
            <select
              value={depoName}
              onChange={(e) => onSwitchDepo(e.target.value)}
              className="text-lg font-extrabold text-gray-800 bg-transparent border-none focus:ring-0 cursor-pointer outline-none appearance-none pr-6 text-right relative"
              style={{
                backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231F2937%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right .2rem top 50%',
                backgroundSize: '.65rem auto',
              }}
            >
              {availableDepolar.map((depo) => (<option key={depo} value={depo}>{depo}</option>))}
            </select>
          </div>
        </div>

        <div className="flex space-x-2 mb-3">
          <input
            type="text"
            placeholder="Ürün veya Barkod Ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            onClick={() => setIsCameraOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg shadow-md transition-colors flex items-center justify-center w-14"
            title="Barkod Okut"
          >
            <span className="text-xl">📷</span>
          </button>
        </div>

        <div className="relative mb-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none bg-white text-gray-700 font-semibold shadow-sm cursor-pointer"
            style={{
              backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231F2937%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 1rem top 50%',
              backgroundSize: '.65rem auto',
            }}
          >
            {categories.map((cat, idx) => (
              <option key={idx} value={cat as string}>{cat === 'Tümü' ? 'Tüm Kategoriler' : (cat as string)}</option>
            ))}
          </select>
        </div>
      </div>

      {isCameraOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50 p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-blue-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg">Barkod Okut</h3>
              <button onClick={() => setIsCameraOpen(false)} className="text-white hover:text-red-300 font-black text-xl px-2">
                ✕
              </button>
            </div>
            {/* CTO Dokunuşu: Kamera yüklenene kadar kutu çökmesin diye minHeight eklendi */}
            <div id="reader" className="w-full bg-black relative" style={{ minHeight: '300px' }}></div>
            <div className="p-4 bg-gray-100 text-center text-sm text-gray-600 font-semibold">
              Kamerayı barkoda veya karekoda hizalayın.
            </div>
          </div>
        </div>
      )}

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {filteredItems.map((item, index) => {
          const cCount = counts[item.Stok];
          const cWaste = waste[item.Stok];
          const cSkt = skt[item.Stok];

          const hasC = cCount !== undefined && cCount !== '';
          const hasW = cWaste !== undefined && cWaste !== '';
          const hasS = cSkt !== undefined && cSkt !== '';

          let exp = Number(item['Kalan Miktar']) || 0;
          exp = Number(exp.toFixed(3));
          if (Math.abs(exp) < 0.0001) exp = 0;

          const cNum = hasC ? Number(cCount.replace(',', '.')) : 0;
          const isDifference = hasC ? cNum !== exp : false;
          const isRecentlySaved = recentlySavedId === item.Stok;
          const hasAnyWaste = hasW || hasS;

          const currentUnit = units[item.Stok] || item.Birim;

          const rowClasses = isRecentlySaved ? 'border-green-500 bg-green-100 scale-[1.02] shadow-md z-10' : !hasC ? 'border-gray-300' : hasAnyWaste ? 'border-red-500 bg-red-50' : isDifference ? 'border-orange-500 bg-orange-50' : 'border-green-500 bg-green-50';

          return (
            <div key={index} className={`bg-white rounded-xl shadow-sm border-l-4 p-4 transition-all duration-500 ${rowClasses}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-2">
                  <span className="text-xs font-bold text-gray-400 uppercase">{item['Stok Grup']}</span>
                  <h3 className="text-lg font-bold text-gray-800 leading-tight mt-1">{item.Stok}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Sistem: <span className="font-semibold text-gray-700">{exp} {item.Birim}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <div className="flex items-center space-x-1">
                    {hasC && !isDifference && !hasAnyWaste && <span className="text-green-500 text-xl font-bold mr-1">✓</span>}
                    {hasC && isDifference && !hasAnyWaste && <span className="text-orange-500 text-xl font-bold mr-1">!</span>}
                    {hasAnyWaste && <span className="text-red-500 text-xl font-bold mr-1">⚠️</span>}

                    <div className="relative flex items-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Miktar"
                        value={cCount || ''}
                        onChange={(e) => handleCountChange(item.Stok, e.target.value)}
                        className={`w-36 sm:w-40 py-2 pl-2 pr-16 text-right text-base sm:text-lg font-bold border-2 rounded-lg focus:outline-none transition-colors ${!hasC ? 'border-gray-300 focus:border-blue-500' : hasAnyWaste ? 'border-red-500 text-red-700' : isDifference ? 'border-orange-500 text-orange-700' : 'border-green-500 text-green-700'}`}
                      />
                      <div className="absolute right-2 flex items-center pointer-events-auto">
                        <select
                          value={currentUnit}
                          onChange={(e) => setUnits(prev => ({ ...prev, [item.Stok]: e.target.value }))}
                          className="text-xs text-blue-600 font-extrabold bg-transparent focus:outline-none appearance-none cursor-pointer pr-3"
                          title="Birimi Değiştir"
                          style={{
                            backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%232563EB%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right center',
                            backgroundSize: '0.45rem',
                          }}
                        >
                          {Array.from(new Set([...UNIT_OPTIONS, item.Birim])).map(u => (<option key={u} value={u as string}>{u as string}</option>))}
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => openAddModal(item.Stok, 'sayim', cCount || '0')}
                      className="bg-blue-100 text-blue-700 w-10 h-10 rounded-lg font-black text-xl hover:bg-blue-200 transition-colors shadow-sm"
                      title="Üzerine Ekle"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => setExpandedItemId(expandedItemId === item.Stok ? null : item.Stok)}
                    className="text-gray-400 hover:text-blue-600 transition-colors flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full"
                  >
                    <span className="text-sm font-semibold">{expandedItemId === item.Stok ? 'Gizle' : 'Detay'}</span>
                    <span className="text-lg">{expandedItemId === item.Stok ? '🔼' : '⚙️'}</span>
                    {(notes[item.Stok] || waste[item.Stok] || skt[item.Stok]) && expandedItemId !== item.Stok && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                  </button>
                </div>
              </div>

              {expandedItemId === item.Stok && (
                <div className="mt-4 pt-3 border-t border-gray-200 bg-gray-50 p-3 rounded-lg shadow-inner">
                  <div className="flex flex-col mb-3 bg-red-100 p-3 rounded-md border border-red-200 space-y-3">

                    <div className="flex items-center justify-between">
                      <label className="text-sm text-red-700 font-bold">🗑️ Zayi (Fire):</label>
                      <div className="flex items-center space-x-1">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={cWaste || ''}
                            onChange={(e) => handleWasteChange(item.Stok, e.target.value)}
                            className="w-28 sm:w-32 py-1 px-2 pr-12 text-right font-bold text-sm sm:text-base text-red-700 border-2 border-red-300 rounded-md focus:outline-none focus:border-red-500"
                          />
                          <span className="absolute right-2 text-xs text-red-400 font-bold pointer-events-none">{currentUnit}</span>
                        </div>
                        <button onClick={() => openAddModal(item.Stok, 'zayi', cWaste || '0')} className="bg-red-200 text-red-800 w-8 h-8 rounded-md font-black hover:bg-red-300 transition-colors">+</button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-sm text-orange-700 font-bold">⏳ SKT Geçmiş:</label>
                      <div className="flex items-center space-x-1">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={cSkt || ''}
                            onChange={(e) => handleSktChange(item.Stok, e.target.value)}
                            className="w-28 sm:w-32 py-1 px-2 pr-12 text-right font-bold text-sm sm:text-base text-orange-700 border-2 border-orange-300 rounded-md focus:outline-none focus:border-orange-500"
                          />
                          <span className="absolute right-2 text-xs text-orange-400 font-bold pointer-events-none">{currentUnit}</span>
                        </div>
                        <button onClick={() => openAddModal(item.Stok, 'skt', cSkt || '0')} className="bg-orange-200 text-orange-800 w-8 h-8 rounded-md font-black hover:bg-orange-300 transition-colors">+</button>
                      </div>
                    </div>

                    {hasC && (hasW || hasS) && (
                      <div className="mt-2 pt-2 border-t border-red-200 flex justify-between items-center text-sm">
                        <span className="text-gray-800 font-bold">Net Kullanılabilir:</span>
                        <span className="text-xl font-black text-green-600">
                          {(Number(cCount.replace(',', '.')) - Number((cWaste || '0').replace(',', '.')) - Number((cSkt || '0').replace(',', '.'))).toFixed(3)}
                        </span>
                      </div>
                    )}
                  </div>

                  <textarea
                    placeholder="Notunuz..."
                    value={notes[item.Stok] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [item.Stok]: e.target.value }))}
                    className="w-full p-2 border rounded-md text-sm mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    rows={2}
                  />
                  <button onClick={() => handleSaveAndClose(item.Stok)} className="w-full bg-green-500 text-white font-bold py-3 rounded-lg shadow-sm">
                    ✓ Kaydet ve Kapat
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filteredItems.length === 0 && <div className="text-center py-10 text-gray-500">Aradığınız kritere uygun ürün bulunamadı.</div>}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-20">
        <button
          onClick={handleFinishAndSave}
          disabled={isSaving}
          className={`w-full max-w-md text-white font-extrabold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center space-x-2 ${isSaving ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
        >
          {isSaving ? <span>Kaydediliyor...</span> : <span>☁️ Buluta Kaydet ve Excel İndir</span>}
        </button>
      </div>

      {addModalState && addModalState.isOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100">
            <h3 className="text-xl font-black text-gray-800 mb-1">{addModalState.title} - Ekleme</h3>
            <p className="text-sm text-gray-600 mb-5 pb-4 border-b border-gray-100">
              <span className="font-bold text-blue-700">{addModalState.stokName}</span>
              <br />Şu anki miktar: <span className="font-bold text-gray-800">{addModalState.currentVal}</span>
            </p>

            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Üzerine Eklenecek Miktar</label>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={addModalInput}
              onChange={(e) => setAddModalInput(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-full p-4 border-2 border-blue-200 rounded-xl text-3xl font-black text-center text-blue-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all mb-6 bg-blue-50"
              placeholder="0"
            />

            <div className="flex space-x-3">
              <button onClick={closeAddModal} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 rounded-xl transition-colors">
                İptal
              </button>
              <button onClick={handleAddSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex justify-center items-center gap-2">
                <span className="text-xl">+</span> Ekle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}