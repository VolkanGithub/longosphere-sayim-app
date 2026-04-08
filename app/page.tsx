'use client';

import { useState, useEffect } from 'react';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import LoginScreen from './components/LoginScreen';
import FileUpload from './components/FileUpload';
import CountingScreen from './components/CountingScreen';
import { useSayimStore } from '../store/useSayimStore';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [selectedDepo, setSelectedDepo] = useState<string | null>(null);

  // YENİ: Güvenlik Modalları için State'ler
  const [showClearModal, setShowClearModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const stockData = useSayimStore((state) => state.stockData);
  const setStockData = useSayimStore((state) => state.setStockData);
  const clearAllStore = useSayimStore((state) => state.clearAll);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDataLoaded = (data: any[]) => {
    setStockData(data);
  };

  // YENİ: Temizleme İşlemi (Modal Onayı ile)
  const handleConfirmClear = () => {
    clearAllStore();
    setShowClearModal(false);
  };

  // YENİ: Çıkış İşlemi (Modal Onayı ile)
  const handleConfirmLogout = async () => {
    await signOut(auth);
    setShowLogoutModal(false);
  };

  const getUniqueDepolar = () => {
    const depolar = stockData.map((item: any) => item.Depolar).filter(Boolean);
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
    <main className="min-h-screen bg-gray-100 flex flex-col items-center relative">
      <div className="w-full bg-blue-900 text-white p-2 text-sm flex justify-between items-center px-4 shadow-md z-10">
        <span>
          Giriş: <span className="font-bold">{user.email}</span>
        </span>
        <div className="space-x-4">
          {stockData.length > 0 && (
            <button
              onClick={() => setShowClearModal(true)}
              className="text-red-300 hover:text-red-100 font-semibold transition-colors"
            >
              Listeyi Sıfırla
            </button>
          )}
          <button
            onClick={() => setShowLogoutModal(true)}
            className="text-blue-200 hover:text-white font-semibold transition-colors"
          >
            Çıkış
          </button>
        </div>
      </div>

      <div
        className={`w-full bg-white shadow-lg ${selectedDepo
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
            items={stockData.filter((item: any) => item.Depolar === selectedDepo)}
            onBack={() => setSelectedDepo(null)}
          />
        )}
      </div>

      {/* YENİ: LİSTEYİ SIFIRLA GÜVENLİK MODALI */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                ⚠️
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Tüm Veriler Silinecek!</h3>
              <p className="text-sm text-gray-500">
                Şu ana kadar yaptığınız <strong>tüm sayımlar</strong> ve depo listesi cihaz hafızasından kalıcı olarak silinecek. Bu işlem geri alınamaz. Emin misiniz?
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowClearModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl transition-colors"
              >
                Vazgeç
              </button>
              <button
                onClick={handleConfirmClear}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors"
              >
                Evet, Sıfırla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YENİ: ÇIKIŞ YAP GÜVENLİK MODALI */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                🚪
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Çıkış Yapıyorsunuz</h3>
              <p className="text-sm text-gray-500">
                Hesabınızdan çıkış yapmak üzeresiniz. Cihazdaki sayım verileriniz silinmeyecek, ancak sisteme tekrar giriş yapmanız gerekecek.
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleConfirmLogout}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}