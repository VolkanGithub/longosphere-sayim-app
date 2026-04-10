'use client';

import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useSayimStore } from '../../store/useSayimStore';

interface CountingScreenProps {
  depoName: string;
  availableDepolar: string[];
  onSwitchDepo: (depo: string) => void;
  items: any[];
  onBack: () => void;
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
}: CountingScreenProps) {
  const {
    counts, updateCount,
    notes, updateNote,
    waste, updateWaste,
    skt, updateSkt,
    units, updateUnit,
    addStockItem,
    updateStockItemBarcode
  } = useSayimStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [recentlySavedId, setRecentlySavedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // UX Durumları
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  const [addModalState, setAddModalState] = useState<{ isOpen: boolean, stokName: string, field: 'sayim' | 'zayi' | 'skt', currentVal: number, title: string } | null>(null);
  const [addModalInput, setAddModalInput] = useState('');

  // Bilinmeyen Barkod Modalı
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [unknownMode, setUnknownMode] = useState<'select' | 'new'>('select');
  const [matchSearch, setMatchSearch] = useState('');
  const [newItemForm, setNewItemForm] = useState({ ad: '', grup: '', birim: 'Adet' });

  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const getKey = (stokName: string) => `${depoName}_${stokName}`;

  // Excel'deki Orijinal Kategorileri (Stok Gruplarını) Alıyoruz
  const rawCategories = useMemo(() => {
    const groups = items.map((item) => item['Stok Grup']).filter(Boolean);
    return Array.from(new Set(groups)).sort() as string[];
  }, [items]);

  const categories = useMemo(() => ['Tümü', ...rawCategories], [rawCategories]);

  // Yeni ürün formu açıldığında ilk kategoriyi otomatik seç
  useEffect(() => {
    if (unknownBarcode && unknownMode === 'new' && !newItemForm.grup && rawCategories.length > 0) {
      setNewItemForm(prev => ({ ...prev, grup: rawCategories[0] }));
    }
  }, [unknownBarcode, unknownMode, rawCategories, newItemForm.grup]);

  useEffect(() => {
    setSearchQuery('');
    setSelectedCategory('Tümü');
    setExpandedItemId(null);
  }, [depoName]);

  // Ortak Odaklanma ve Parlama Fonksiyonu
  const focusOnItem = (stokName: string) => {
    setExpandedItemId(stokName);
    setHighlightedItemId(stokName);
    setTimeout(() => {
      const elementId = `item-${stokName.replace(/\s+/g, '-')}`;
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
    setTimeout(() => {
      setHighlightedItemId(null);
    }, 3000);
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isComponentMounted = true;

    if (isCameraOpen) {
      setTimeout(() => {
        if (!isComponentMounted) return;

        html5QrCode = new Html5Qrcode("reader", {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128 // SADECE BU İKİSİ: Maksimum performans!
          ]
        });

        html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: { width: 280, height: 280 } // Optimize edilmiş QR ve Barkod kutusu
          },
          (decodedText) => {
            if (navigator.vibrate) navigator.vibrate(200);
            setIsCameraOpen(false);

            const foundItem = items.find(item =>
              String(item.Barkod).toLowerCase() === decodedText.toLowerCase() ||
              item.Stok.toLowerCase() === decodedText.toLowerCase()
            );

            if (foundItem) {
              focusOnItem(foundItem.Stok);
            } else {
              if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
              setUnknownBarcode(decodedText);
              setMatchSearch(''); // Modal açılınca aramayı temizle
            }
          },
          (errorMessage) => { }
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
        html5QrCode.stop().then(() => {
          html5QrCode?.clear();
        }).catch(console.error);
      }
    };
  }, [isCameraOpen, items]);

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
    updateCount(getKey(stokName), value.replace(/[^0-9.,]/g, ''));
  };

  const handleWasteChange = (stokName: string, value: string) => {
    updateWaste(getKey(stokName), value.replace(/[^0-9.,]/g, ''));
  };

  const handleSktChange = (stokName: string, value: string) => {
    updateSkt(getKey(stokName), value.replace(/[^0-9.,]/g, ''));
  };

  const handleSaveAndClose = (stokName: string) => {
    setExpandedItemId(null);
    setRecentlySavedId(stokName);
    setTimeout(() => setRecentlySavedId(null), 800);
  };

  const openAddModal = (stokName: string, field: 'sayim' | 'zayi' | 'skt', currentValStr: string) => {
    const currentVal = Number(String(currentValStr || '0').replace(',', '.'));
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
    const eklenecek = Number(String(addModalInput || '0').replace(',', '.'));
    if (!isNaN(eklenecek) && eklenecek > 0) {
      const yeniToplam = addModalState.currentVal + eklenecek;
      const yeniStr = yeniToplam.toString().replace('.', ',');

      if (addModalState.field === 'sayim') handleCountChange(addModalState.stokName, yeniStr);
      if (addModalState.field === 'zayi') handleWasteChange(addModalState.stokName, yeniStr);
      if (addModalState.field === 'skt') handleSktChange(addModalState.stokName, yeniStr);
    }
    closeAddModal();
  };

  // Hibrit Motor: Mevcut Ürünle Eşleştir
  const handleMatchSubmit = (stokName: string) => {
    if (!unknownBarcode) return;
    updateStockItemBarcode(stokName, unknownBarcode);
    setUnknownBarcode(null);
    setSearchQuery('');
    focusOnItem(stokName);
    setToastMessage({ text: 'Barkod başarıyla eşleştirildi!', type: 'success' });
  };

  // Hibrit Motor: Sıfırdan Yeni Ürün Ekle
  const handleNewSubmit = () => {
    if (!newItemForm.ad || !unknownBarcode) {
      alert("Lütfen ürün adı girin!");
      return;
    }
    addStockItem({
      Depolar: depoName,
      'Stok Grup': newItemForm.grup || 'Diğer',
      Stok: newItemForm.ad,
      Barkod: unknownBarcode,
      Birim: newItemForm.birim,
      'Kalan Miktar': 0 // Yeni ürün
    });
    setUnknownBarcode(null);
    setSearchQuery('');
    focusOnItem(newItemForm.ad);
    setToastMessage({ text: 'Yeni ürün Excel formatında eklendi!', type: 'success' });
    setNewItemForm({ ad: '', grup: rawCategories[0] || 'Diğer', birim: 'Adet' });
  };

  const handleFinishAndSave = async () => {
    setIsSaving(true);
    try {
      const exportData = items.map((item) => {
        const key = getKey(item.Stok);
        const cCount = counts[key];
        const cWaste = waste[key];
        const cSkt = skt[key];
        const hasC = cCount !== undefined && cCount !== '';
        const hasW = cWaste !== undefined && cWaste !== '';
        const hasS = cSkt !== undefined && cSkt !== '';
        const exp = Number((Number(item['Kalan Miktar']) || 0).toFixed(3));
        const cNum = hasC ? Number(String(cCount).replace(',', '.')) : 0;
        const wNum = hasW ? Number(String(cWaste).replace(',', '.')) : 0;
        const sNum = hasS ? Number(String(cSkt).replace(',', '.')) : 0;
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
          Birim: units[key] || item.Birim,
          'Kalan Miktar': Math.abs(exp) < 0.0001 ? 0 : exp,
          'Sayım Miktarı': hasC ? cNum : '',
          'Fark Miktarı': formattedDiff,
          Zayi: hasW ? wNum : '',
          'SKT Geçmiş': hasS ? sNum : '',
          'Net Kullanılabilir': hasC ? netUsable : '',
          'Sayım Notu': notes[key] || '',
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

      {/* TIKLANINCA KAPANAN VE TAŞMAYAN ÜST BİLDİRİM BALONU */}
      {toastMessage && (
        <div
          onClick={() => setToastMessage(null)}
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-2xl font-bold text-sm flex items-center space-x-2 transition-all duration-300 max-w-[90%] w-max cursor-pointer ${toastMessage.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}
        >
          <span className="text-xl flex-shrink-0">{toastMessage.type === 'error' ? '⚠️' : '✓'}</span>
          <span className="break-words">{toastMessage.text}</span>
        </div>
      )}

      <div className="bg-white p-4 shadow-sm sticky top-0 z-10">
        <div className="flex justify-between items-center mb-4">
          <button onClick={onBack} className="text-blue-600 font-bold hover:underline px-2 py-1">← Geri</button>
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
          <button onClick={() => setIsCameraOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg shadow-md transition-colors flex items-center justify-center w-14">
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
          <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-blue-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg">Barkod Okut</h3>
              <button onClick={() => setIsCameraOpen(false)} className="text-white hover:text-red-300 font-black text-xl px-2">✕</button>
            </div>
            <div id="reader" className="w-full bg-black relative flex-1" style={{ minHeight: '300px' }}></div>
            <div className="p-4 bg-gray-100 text-center text-sm text-gray-600 font-semibold">Kamerayı barkoda veya karekoda hizalayın.</div>
          </div>
        </div>
      )}

      {/* BİLİNMEYEN BARKOD MODALI (Hibrit Motor) */}
      {unknownBarcode && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-[80] p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-red-600 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg">⚠️ Ürün Bulunamadı</h3>
              <button onClick={() => setUnknownBarcode(null)} className="text-white hover:text-red-200 font-black text-xl px-2">✕</button>
            </div>

            <div className="p-4 bg-red-50 text-red-800 text-sm border-b border-red-100">
              Okutulan barkod: <span className="font-mono font-bold break-all">{unknownBarcode}</span><br />
              Sistemde bulunamadı. Lütfen işlem seçin:
            </div>

            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setUnknownMode('select')}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${unknownMode === 'select' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 bg-gray-50 hover:bg-gray-100'}`}
              >
                🔗 Eşleştir
              </button>
              <button
                onClick={() => setUnknownMode('new')}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${unknownMode === 'new' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 bg-gray-50 hover:bg-gray-100'}`}
              >
                ➕ Yeni Kayıt
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              {unknownMode === 'select' ? (
                <div>
                  <input
                    type="text"
                    placeholder="Eşleştirilecek ürünü ara..."
                    value={matchSearch}
                    onChange={(e) => setMatchSearch(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {items.filter(i => normalizeText(i.Stok).includes(normalizeText(matchSearch))).slice(0, 50).map((i, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleMatchSubmit(i.Stok)}
                        className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm"
                      >
                        <div className="font-bold text-gray-800 text-sm">{i.Stok}</div>
                        <div className="text-xs text-gray-500 mt-1">Mevcut Barkod: <span className="font-mono font-semibold text-gray-700">{i.Barkod || 'Yok'}</span></div>
                      </button>
                    ))}
                    {items.filter(i => normalizeText(i.Stok).includes(normalizeText(matchSearch))).length === 0 && (
                      <div className="text-center text-gray-500 text-sm py-4">Ürün bulunamadı.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Ürün Adı (Zorunlu)</label>
                    <input type="text" value={newItemForm.ad} onChange={e => setNewItemForm({ ...newItemForm, ad: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Örn: Coca Cola 330ml" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Stok Grubu (Excel&apos;den)</label>
                    <div className="relative">
                      <select value={newItemForm.grup} onChange={e => setNewItemForm({ ...newItemForm, grup: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg appearance-none bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer pr-10">
                        {rawCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">▼</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Birim</label>
                    <div className="relative">
                      <select value={newItemForm.birim} onChange={e => setNewItemForm({ ...newItemForm, birim: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg appearance-none bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer pr-10">
                        {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">▼</div>
                    </div>
                  </div>
                  <button onClick={handleNewSubmit} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl mt-4 shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
                    Sisteme Kaydet
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {filteredItems.map((item, index) => {
          const key = getKey(item.Stok);
          const cCount = counts[key];
          const cWaste = waste[key];
          const cSkt = skt[key];
          const hasC = cCount !== undefined && cCount !== '';
          const hasW = cWaste !== undefined && cWaste !== '';
          const hasS = cSkt !== undefined && cSkt !== '';
          const safeCount = Number(String(cCount || '0').replace(',', '.'));
          const safeWaste = Number(String(cWaste || '0').replace(',', '.'));
          const safeSkt = Number(String(cSkt || '0').replace(',', '.'));
          const netUsable = (safeCount - safeWaste - safeSkt).toFixed(3);
          let exp = Number(item['Kalan Miktar']) || 0;
          exp = Number(exp.toFixed(3));
          if (Math.abs(exp) < 0.0001) exp = 0;
          const isDifference = hasC ? safeCount !== exp : false;
          const isRecentlySaved = recentlySavedId === item.Stok;
          const isHighlighted = highlightedItemId === item.Stok;
          const hasAnyWaste = hasW || hasS;
          const currentUnit = units[key] || item.Birim;

          const rowClasses = isHighlighted
            ? 'border-yellow-500 bg-yellow-100 scale-[1.02] shadow-xl z-20 ring-4 ring-yellow-400'
            : isRecentlySaved
              ? 'border-green-500 bg-green-100 scale-[1.02] shadow-md z-10'
              : !hasC ? 'border-gray-300' : hasAnyWaste ? 'border-red-500 bg-red-50' : isDifference ? 'border-orange-500 bg-orange-50' : 'border-green-500 bg-green-50';

          return (
            <div key={index} id={`item-${item.Stok.replace(/\s+/g, '-')}`} className={`bg-white rounded-xl shadow-sm border-l-4 p-4 transition-all duration-500 ${rowClasses}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-2">
                  <span className="text-xs font-bold text-gray-400 uppercase">{item['Stok Grup']}</span>
                  <h3 className="text-lg font-bold text-gray-800 leading-tight mt-1">{item.Stok}</h3>
                  <p className="text-sm text-gray-500 mt-1">Sistem: <span className="font-semibold text-gray-700">{exp} {item.Birim}</span></p>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <div className="flex items-center space-x-1">
                    {hasC && !isDifference && !hasAnyWaste && <span className="text-green-500 text-xl font-bold mr-1">✓</span>}
                    {hasC && isDifference && !hasAnyWaste && <span className="text-orange-500 text-xl font-bold mr-1">!</span>}
                    {hasAnyWaste && <span className="text-red-500 text-xl font-bold mr-1">⚠️</span>}
                    <div className="relative flex items-center">
                      <input
                        type="text" inputMode="decimal" placeholder="Miktar" value={cCount || ''}
                        onChange={(e) => handleCountChange(item.Stok, e.target.value)}
                        className={`w-36 sm:w-40 py-2 pl-2 pr-16 text-right text-base sm:text-lg font-bold border-2 rounded-lg focus:outline-none transition-colors ${!hasC ? 'border-gray-300 focus:border-blue-500' : hasAnyWaste ? 'border-red-500 text-red-700' : isDifference ? 'border-orange-500 text-orange-700' : 'border-green-500 text-green-700'}`}
                      />
                      <div className="absolute right-2 flex items-center pointer-events-auto">
                        <select
                          value={currentUnit} onChange={(e) => updateUnit(key, e.target.value)}
                          className="text-xs text-blue-600 font-extrabold bg-transparent focus:outline-none appearance-none cursor-pointer pr-3"
                          style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%232563EB%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '0.45rem' }}
                        >
                          {Array.from(new Set([...UNIT_OPTIONS, item.Birim])).map(u => (<option key={u} value={u as string}>{u as string}</option>))}
                        </select>
                      </div>
                    </div>
                    <button onClick={() => openAddModal(item.Stok, 'sayim', cCount || '0')} className="bg-blue-100 text-blue-700 w-10 h-10 rounded-lg font-black text-xl hover:bg-blue-200 shadow-sm">+</button>
                  </div>
                  <button onClick={() => setExpandedItemId(expandedItemId === item.Stok ? null : item.Stok)} className="text-gray-400 hover:text-blue-600 transition-colors flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full text-sm font-semibold">
                    <span>{expandedItemId === item.Stok ? 'Gizle 🔼' : 'Detay ⚙️'}</span>
                    {(notes[key] || waste[key] || skt[key]) && expandedItemId !== item.Stok && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                  </button>
                </div>
              </div>
              {expandedItemId === item.Stok && (
                <div className="mt-4 pt-3 border-t border-gray-200 bg-gray-50 p-3 rounded-lg shadow-inner">
                  <div className="flex flex-col mb-3 bg-red-100 p-3 rounded-md border border-red-200 space-y-3 text-sm">
                    <div className="flex justify-between items-center"><label className="text-red-700 font-bold">🗑️ Zayi (Fire):</label>
                      <div className="flex items-center space-x-1"><div className="relative"><input type="text" inputMode="decimal" value={cWaste || ''} onChange={(e) => handleWasteChange(item.Stok, e.target.value)} className="w-28 sm:w-32 py-1 px-2 pr-12 text-right font-bold text-red-700 border-2 border-red-300 rounded-md" /><span className="absolute right-2 text-xs text-red-400 font-bold">{currentUnit}</span></div><button onClick={() => openAddModal(item.Stok, 'zayi', cWaste || '0')} className="bg-red-200 text-red-800 w-8 h-8 rounded-md font-black">+</button></div>
                    </div>
                    <div className="flex justify-between items-center"><label className="text-orange-700 font-bold">⏳ SKT Geçmiş:</label>
                      <div className="flex items-center space-x-1"><div className="relative"><input type="text" inputMode="decimal" value={cSkt || ''} onChange={(e) => handleSktChange(item.Stok, e.target.value)} className="w-28 sm:w-32 py-1 px-2 pr-12 text-right font-bold text-orange-700 border-2 border-orange-300 rounded-md" /><span className="absolute right-2 text-xs text-orange-400 font-bold">{currentUnit}</span></div><button onClick={() => openAddModal(item.Stok, 'skt', cSkt || '0')} className="bg-orange-200 text-orange-800 w-8 h-8 rounded-md font-black">+</button></div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-red-200 flex justify-between items-center bg-white p-2 rounded-md shadow-sm">
                      <span className="text-gray-800 font-bold">Net Kullanılabilir:</span>
                      <span className={`text-xl font-black ${safeCount > 0 ? 'text-green-600' : 'text-gray-400'}`}>{netUsable}</span>
                    </div>
                  </div>
                  <textarea placeholder="Notunuz..." value={notes[key] || ''} onChange={(e) => updateNote(key, e.target.value)} className="w-full p-2 border rounded-md text-sm mb-3 focus:ring-2 focus:ring-blue-500" rows={2} />
                  <button onClick={() => handleSaveAndClose(item.Stok)} className="w-full bg-green-500 text-white font-bold py-3 rounded-lg shadow-sm">✓ Kaydet ve Kapat</button>
                </div>
              )}
            </div>
          );
        })}

        {filteredItems.length === 0 && !isCameraOpen && !unknownBarcode && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300">
            <span className="text-5xl mb-4">🔍</span>
            <h3 className="text-xl font-black text-gray-800">Ürün Listede Yok</h3>
            <p className="text-gray-500 text-sm mt-2 font-medium">Aradığınız kriterlere uygun<br />bir depo kaydı bulunamadı.</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-20">
        <button onClick={handleFinishAndSave} disabled={isSaving} className={`w-full max-w-md text-white font-extrabold py-4 rounded-xl shadow-lg flex items-center justify-center space-x-2 ${isSaving ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
          {isSaving ? <span>Kaydediliyor...</span> : <span>☁️ Buluta Kaydet ve Excel İndir</span>}
        </button>
      </div>

      {addModalState && addModalState.isOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-black text-gray-800 mb-1">{addModalState.title} - Ekleme</h3>
            <p className="text-sm text-gray-600 mb-5 pb-4 border-b border-gray-100"><span className="font-bold text-blue-700">{addModalState.stokName}</span><br />Şu anki: <span className="font-bold">{addModalState.currentVal}</span></p>
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Eklenecek Miktar</label>
            <input type="text" inputMode="decimal" autoFocus value={addModalInput} onChange={(e) => setAddModalInput(e.target.value.replace(/[^0-9.,]/g, ''))} className="w-full p-4 border-2 border-blue-200 rounded-xl text-3xl font-black text-center text-blue-900 mb-6 bg-blue-50" placeholder="0" />
            <div className="flex space-x-3"><button onClick={closeAddModal} className="flex-1 bg-gray-100 text-gray-700 font-bold py-4 rounded-xl">İptal</button><button onClick={handleAddSubmit} className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg">+ Ekle</button></div>
          </div>
        </div>
      )}
    </div>
  );
}