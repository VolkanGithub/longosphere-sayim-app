'use client';

import { useState, useEffect } from 'react';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import LoginScreen from './components/LoginScreen';
import FileUpload from './components/FileUpload';
import CountingScreen from './components/CountingScreen';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [stockData, setStockData] = useState<any[]>([]);
  const [selectedDepo, setSelectedDepo] = useState<string | null>(null);

  const [globalCounts, setGlobalCounts] = useState<Record<string, string>>({});
  const [globalNotes, setGlobalNotes] = useState<Record<string, string>>({});
  const [globalWaste, setGlobalWaste] = useState<Record<string, string>>({});
  // YENİ: SKT Geçmiş Miktarlar için global hafıza
  const [globalSkt, setGlobalSkt] = useState<Record<string, string>>({});

  useEffect(() => {
    const savedData = localStorage.getItem('longosphere_backup');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      if (parsed.stockData) setStockData(parsed.stockData);
      if (parsed.globalCounts) setGlobalCounts(parsed.globalCounts);
      if (parsed.globalNotes) setGlobalNotes(parsed.globalNotes);
      if (parsed.globalWaste) setGlobalWaste(parsed.globalWaste);
      if (parsed.globalSkt) setGlobalSkt(parsed.globalSkt); // SKT'yi hafızadan yükle
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (stockData.length > 0) {
      // SKT'yi yedekleme paketine dahil et
      const backup = {
        stockData,
        globalCounts,
        globalNotes,
        globalWaste,
        globalSkt,
      };
      localStorage.setItem('longosphere_backup', JSON.stringify(backup));
    }
  }, [stockData, globalCounts, globalNotes, globalWaste, globalSkt]);

  const handleDataLoaded = (data: any[]) => {
    setStockData(data);
  };

  const handleClearAll = () => {
    if (
      confirm(
        'Tüm sayım verilerini silip yeni liste yüklemek istediğinize emin misiniz?'
      )
    ) {
      setStockData([]);
      setGlobalCounts({});
      setGlobalNotes({});
      setGlobalWaste({});
      setGlobalSkt({}); // Yeni listede SKT'yi de sıfırla
      localStorage.removeItem('longosphere_backup');
    }
  };

  const getUniqueDepolar = () => {
    const depolar = stockData.map((item) => item.Depolar).filter(Boolean);
    return Array.from(new Set(depolar)).sort();
  };

  if (isAuthLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 font-bold">
        Sistem kontrol ediliyor...
      </div>
    );
  if (!user) return <LoginScreen />;

  return (
    <main className="min-h-screen bg-gray-100 flex flex-col items-center">
      <div className="w-full bg-blue-900 text-white p-2 text-sm flex justify-between items-center px-4">
        <span>
          Giriş: <span className="font-bold">{user.email}</span>
        </span>
        <div className="space-x-4">
          {stockData.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-red-300 hover:text-red-100 underline"
            >
              Listeyi Sıfırla
            </button>
          )}
          <button
            onClick={() => signOut(auth)}
            className="text-blue-200 hover:text-white underline"
          >
            Çıkış
          </button>
        </div>
      </div>

      <div
        className={`w-full bg-white shadow-lg ${
          selectedDepo
            ? 'max-w-md min-h-screen'
            : 'max-w-4xl p-8 mt-4 rounded-xl'
        }`}
      >
        {!selectedDepo && (
          <>
            <h1 className="text-3xl font-extrabold text-gray-800 mb-2 text-center">
              Longosphere
            </h1>
            <p className="text-gray-500 text-center mb-8">
              Dijital Depo ve Stok Sayım Sistemi
            </p>
          </>
        )}

        {stockData.length === 0 && (
          <FileUpload onDataLoaded={handleDataLoaded} />
        )}

        {stockData.length > 0 && !selectedDepo && (
          <div className="w-full animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">
              Sayım Yapılacak Depo
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getUniqueDepolar().map((depo, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedDepo(depo as string)}
                  className="bg-white border-2 border-blue-500 text-blue-700 hover:bg-blue-500 hover:text-white font-bold py-4 rounded-lg shadow-sm transition-all"
                >
                  {depo as string}
                </button>
              ))}
            </div>
          </div>
        )}

        {stockData.length > 0 && selectedDepo && (
          <CountingScreen
            depoName={selectedDepo}
            availableDepolar={getUniqueDepolar() as string[]}
            onSwitchDepo={(newDepo) => setSelectedDepo(newDepo)}
            items={stockData.filter((item) => item.Depolar === selectedDepo)}
            onBack={() => setSelectedDepo(null)}
            counts={globalCounts}
            setCounts={setGlobalCounts}
            notes={globalNotes}
            setNotes={setGlobalNotes}
            waste={globalWaste}
            setWaste={setGlobalWaste}
            // YENİ: SKT hafızasını ekrana gönderiyoruz
            skt={globalSkt}
            setSkt={setGlobalSkt}
          />
        )}
      </div>
    </main>
  );
}
