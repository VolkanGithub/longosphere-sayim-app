'use client';

import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

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
}

// YENİ: KUSURSUZ ARAMA (NORMALİZASYON) FONKSİYONU
// Türkçe ve İngilizce karakter çatışmalarını (Örn: I, ı, İ, i) arka planda tek tipe indirger.
const normalizeText = (text: string) => {
  if (!text) return '';
  return text
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .toLowerCase();
};

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
}: CountingScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [recentlySavedId, setRecentlySavedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSearchQuery('');
    setSelectedCategory('Tümü');
    setExpandedItemId(null);
  }, [depoName]);

  const categories = useMemo(() => {
    const groups = items.map((item) => item['Stok Grup']).filter(Boolean);
    return ['Tümü', ...Array.from(new Set(groups))];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // YENİ: Hem aranan kelimeyi hem de ürün adını "düzleştirip" karşılaştırıyoruz.
      const searchVal = normalizeText(searchQuery);
      const itemVal = normalizeText(item.Stok);

      return (
        itemVal.includes(searchVal) &&
        (selectedCategory === 'Tümü' || item['Stok Grup'] === selectedCategory)
      );
    });
  }, [items, searchQuery, selectedCategory]);

  const handleCountChange = (stokName: string, value: string) => {
    setCounts((prev) => ({
      ...prev,
      [stokName]: value.replace(/[^0-9.,]/g, ''),
    }));
  };

  const handleWasteChange = (stokName: string, value: string) => {
    setWaste((prev) => ({
      ...prev,
      [stokName]: value.replace(/[^0-9.,]/g, ''),
    }));
  };

  const handleSktChange = (stokName: string, value: string) => {
    setSkt((prev) => ({ ...prev, [stokName]: value.replace(/[^0-9.,]/g, '') }));
  };

  const handleSaveAndClose = (stokName: string) => {
    setExpandedItemId(null);
    setRecentlySavedId(stokName);
    setTimeout(() => setRecentlySavedId(null), 800);
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
          Birim: item.Birim,
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
          <button
            onClick={onBack}
            className="text-blue-600 font-bold hover:underline px-2 py-1"
          >
            ← Geri
          </button>

          <div className="flex bg-gray-100 rounded-lg px-2 py-1 border border-gray-200">
            <select
              value={depoName}
              onChange={(e) => onSwitchDepo(e.target.value)}
              className="text-lg font-extrabold text-gray-800 bg-transparent border-none focus:ring-0 cursor-pointer outline-none appearance-none pr-6 text-right relative"
              style={{
                backgroundImage:
                  'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231F2937%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right .2rem top 50%',
                backgroundSize: '.65rem auto',
              }}
            >
              {availableDepolar.map((depo) => (
                <option key={depo} value={depo}>
                  {depo}
                </option>
              ))}
            </select>
          </div>
        </div>

        <input
          type="text"
          placeholder="Ürün Ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none mb-3"
        />

        <div className="relative mb-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none bg-white text-gray-700 font-semibold shadow-sm cursor-pointer"
            style={{
              backgroundImage:
                'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231F2937%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 1rem top 50%',
              backgroundSize: '.65rem auto',
            }}
          >
            {categories.map((cat, idx) => (
              <option key={idx} value={cat as string}>
                {cat === 'Tümü' ? 'Tüm Kategoriler' : (cat as string)}
              </option>
            ))}
          </select>
        </div>
      </div>

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

          const rowClasses = isRecentlySaved
            ? 'border-green-500 bg-green-100 scale-[1.02] shadow-md z-10'
            : !hasC
            ? 'border-gray-300'
            : hasAnyWaste
            ? 'border-red-500 bg-red-50'
            : isDifference
            ? 'border-orange-500 bg-orange-50'
            : 'border-green-500 bg-green-50';

          return (
            <div
              key={index}
              className={`bg-white rounded-xl shadow-sm border-l-4 p-4 transition-all duration-500 ${rowClasses}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-2">
                  <span className="text-xs font-bold text-gray-400 uppercase">
                    {item['Stok Grup']}
                  </span>
                  <h3 className="text-lg font-bold text-gray-800 leading-tight mt-1">
                    {item.Stok}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Sistem:{' '}
                    <span className="font-semibold text-gray-700">
                      {exp} {item.Birim}
                    </span>
                  </p>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <div className="flex items-center space-x-2">
                    {hasC && !isDifference && !hasAnyWaste && (
                      <span className="text-green-500 text-xl font-bold">
                        ✓
                      </span>
                    )}
                    {hasC && isDifference && !hasAnyWaste && (
                      <span className="text-orange-500 text-xl font-bold">
                        !
                      </span>
                    )}
                    {hasAnyWaste && (
                      <span className="text-red-500 text-xl font-bold">⚠️</span>
                    )}

                    <div className="relative flex items-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Miktar"
                        value={cCount || ''}
                        onChange={(e) =>
                          handleCountChange(item.Stok, e.target.value)
                        }
                        className={`w-28 py-2 pl-2 pr-10 text-right text-lg font-bold border-2 rounded-lg focus:outline-none transition-colors ${
                          !hasC
                            ? 'border-gray-300 focus:border-blue-500'
                            : hasAnyWaste
                            ? 'border-red-500 text-red-700'
                            : isDifference
                            ? 'border-orange-500 text-orange-700'
                            : 'border-green-500 text-green-700'
                        }`}
                      />
                      <span className="absolute right-2 text-xs text-gray-500 font-bold">
                        {item.Birim}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setExpandedItemId(
                        expandedItemId === item.Stok ? null : item.Stok
                      )
                    }
                    className="text-gray-400 hover:text-blue-600 transition-colors flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full"
                  >
                    <span className="text-sm font-semibold">
                      {expandedItemId === item.Stok ? 'Gizle' : 'Detay'}
                    </span>
                    <span className="text-lg">
                      {expandedItemId === item.Stok ? '🔼' : '⚙️'}
                    </span>
                    {(notes[item.Stok] || waste[item.Stok] || skt[item.Stok]) &&
                      expandedItemId !== item.Stok && (
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      )}
                  </button>
                </div>
              </div>

              {expandedItemId === item.Stok && (
                <div className="mt-4 pt-3 border-t border-gray-200 bg-gray-50 p-3 rounded-lg shadow-inner">
                  <div className="flex flex-col mb-3 bg-red-100 p-3 rounded-md border border-red-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-red-700 font-bold">
                        🗑️ Zayi (Fire):
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={cWaste || ''}
                          onChange={(e) =>
                            handleWasteChange(item.Stok, e.target.value)
                          }
                          className="w-20 py-1 px-2 text-right font-bold text-red-700 border-2 border-red-300 rounded-md focus:outline-none focus:border-red-500"
                        />
                        <span className="absolute right-8 text-xs text-red-400 font-bold bg-transparent pointer-events-none">
                          {item.Birim}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-sm text-orange-700 font-bold">
                        ⏳ SKT Geçmiş:
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={cSkt || ''}
                          onChange={(e) =>
                            handleSktChange(item.Stok, e.target.value)
                          }
                          className="w-20 py-1 px-2 text-right font-bold text-orange-700 border-2 border-orange-300 rounded-md focus:outline-none focus:border-orange-500"
                        />
                        <span className="absolute right-8 text-xs text-orange-400 font-bold bg-transparent pointer-events-none">
                          {item.Birim}
                        </span>
                      </div>
                    </div>

                    {hasC && (hasW || hasS) && (
                      <div className="mt-2 pt-2 border-t border-red-200 flex justify-between items-center text-sm">
                        <span className="text-gray-800 font-bold">
                          Net Kullanılabilir:
                        </span>
                        <span className="text-xl font-black text-green-600">
                          {(
                            Number(cCount.replace(',', '.')) -
                            Number((cWaste || '0').replace(',', '.')) -
                            Number((cSkt || '0').replace(',', '.'))
                          ).toFixed(3)}
                        </span>
                      </div>
                    )}
                  </div>

                  <textarea
                    placeholder="Notunuz..."
                    value={notes[item.Stok] || ''}
                    onChange={(e) =>
                      setNotes((prev) => ({
                        ...prev,
                        [item.Stok]: e.target.value,
                      }))
                    }
                    className="w-full p-2 border rounded-md text-sm mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    rows={2}
                  />
                  <button
                    onClick={() => handleSaveAndClose(item.Stok)}
                    className="w-full bg-green-500 text-white font-bold py-3 rounded-lg shadow-sm"
                  >
                    ✓ Kaydet ve Kapat
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filteredItems.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            Aradığınız kritere uygun ürün bulunamadı.
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-20">
        <button
          onClick={handleFinishAndSave}
          disabled={isSaving}
          className={`w-full max-w-md text-white font-extrabold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center space-x-2 ${
            isSaving ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isSaving ? (
            <span>Kaydediliyor...</span>
          ) : (
            <span>☁️ Buluta Kaydet ve Excel İndir</span>
          )}
        </button>
      </div>
    </div>
  );
}
