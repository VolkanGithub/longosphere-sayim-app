'use client';

import { useState, useEffect } from 'react';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import LoginScreen from './components/LoginScreen';
import FileUpload from './components/FileUpload';
import CountingScreen from './components/CountingScreen';
import { useSayimStore } from '../store/useSayimStore';

const ADMIN_EMAILS = ['volkanozkan@outlook.com'];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // UX Durum Yönetimi (decision: Karar Ekranı, depoSelect: Depo Seçimi, upload: Yeni Excel)
  const [selectedDepo, setSelectedDepo] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'decision' | 'depoSelect' | 'upload'>('decision');

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
    if (stockData.length > 0) {
      const onay = window.confirm("⚠️ DİKKAT! Yeni Excel yüklüyorsunuz. Bu işlem cihazdaki mevcut tüm sayımları SİLECEKTİR. Onaylıyor musunuz?");
      if (!onay) return;
    }
    setStockData(data);
    setViewMode('depoSelect'); // Yükleme bittikten sonra doğrudan depoları göster
  };

  const handleConfirmClear = () => {
    clearAllStore();
    setShowClearModal(false);
    setViewMode('upload');
  };

  const handleConfirmLogout = async () => {
    await signOut(auth);
    setShowLogoutModal(false);
  };

  const getUniqueDepolar = () => {
    const depolar = stockData.map((item: any) => item.Depolar).filter(Boolean);
    return Array.from(new Set(depolar)).sort();
  };

  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-100 font-bold">Sistem kontrol ediliyor...</div>;
  if (!user) return <LoginScreen />;

  const isAdmin = user.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;
  const hasData = stockData.length > 0;

  return (
    <main className="min-h-screen bg-gray-100 flex flex-col items-center relative pb-10">

      {/* Üst Bar */}
      <div className="w-full bg-blue-900 text-white p-2 text-sm flex justify-between items-center px-4 shadow-md z-10 sticky top-0">
        <span className="flex items-center">
          <span>Giriş: <span className="font-bold">{user.email}</span></span>
          {isAdmin && <span className="ml-3 bg-yellow-500 text-yellow-900 text-xs px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Admin</span>}
        </span>
        <div className="space-x-4">
          {hasData && isAdmin && (
            <button onClick={() => setShowClearModal(true)} className="text-red-300 hover:text-red-100 font-semibold transition-colors">Listeyi Sıfırla</button>
          )}
          <button onClick={() => setShowLogoutModal(true)} className="text-blue-200 hover:text-white font-semibold transition-colors">Çıkış</button>
        </div>
      </div>

      <div className={`w-full ${selectedDepo ? 'max-w-md min-h-screen bg-white shadow-lg' : 'max-w-4xl p-4 md:p-8 mt-2'}`}>

        {!selectedDepo && (
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Longosphere</h1>
            <p className="text-gray-500">Dijital Depo ve Stok Sayım Sistemi</p>
          </div>
        )}

        {/* 1. DURUM: PERSONEL GİRİŞİ VE VERİ YOK */}
        {!hasData && !isAdmin && (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 rounded-2xl bg-white shadow-sm">
            <span className="text-6xl mb-4 text-gray-300">📭</span>
            <h2 className="text-xl font-bold text-gray-700 mb-2 text-center">Sayım Listesi Bekleniyor</h2>
            <p className="text-gray-500 text-center max-w-xs">Henüz sisteme güncel bir sayım Excel&apos;i yüklenmemiş. Lütfen yöneticinizi bekleyin.</p>
          </div>
        )}

        {/* 2. DURUM: VERİ YOK (ADMİN İÇİN İLK EKRAN) */}
        {!hasData && isAdmin && !selectedDepo && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 animate-fade-in">
            <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Sistemi Başlat: Excel Yükle</h2>
            <FileUpload onDataLoaded={handleDataLoaded} />
          </div>
        )}

        {/* 3. DURUM: ADMİN İÇİN KARAR EKRANI (İki Dev Buton) */}
        {hasData && !selectedDepo && viewMode === 'decision' && isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in mt-4">
            <button
              onClick={() => setViewMode('depoSelect')}
              className="bg-blue-600 hover:bg-blue-700 text-white p-10 rounded-2xl shadow-lg transition-transform active:scale-95 flex flex-col items-center justify-center h-64"
            >
              <span className="text-6xl mb-4">📦</span>
              <span className="text-2xl font-black text-center">Mevcut Sayıma<br />Devam Et</span>
            </button>

            <button
              onClick={() => setViewMode('upload')}
              className="bg-gray-800 hover:bg-black text-white p-10 rounded-2xl shadow-lg transition-transform active:scale-95 flex flex-col items-center justify-center h-64"
            >
              <span className="text-6xl mb-4">📄</span>
              <span className="text-2xl font-black text-center">Yeni Sayım<br />Başlat</span>
            </button>
          </div>
        )}

        {/* 4. DURUM: DEPO SEÇİM EKRANI (Personel direkt burayı görür, Admin Karar ekranından gelir) */}
        {hasData && !selectedDepo && (!isAdmin || viewMode === 'depoSelect') && (
          <div className="bg-white border-2 border-blue-100 p-6 rounded-2xl shadow-md animate-fade-in">
            <div className="flex items-center mb-6 border-b pb-4">
              {isAdmin && (
                <button
                  onClick={() => setViewMode('decision')}
                  className="mr-4 text-blue-600 font-bold hover:underline"
                >
                  ← Geri
                </button>
              )}
              <h2 className="text-xl font-bold text-gray-800 w-full text-center pr-8">
                Sayım Yapılacak Depoyu Seçin
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {getUniqueDepolar().map((depo, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedDepo(depo as string)}
                  className="bg-blue-50 border-2 border-blue-500 text-blue-700 hover:bg-blue-600 hover:text-white font-bold py-5 rounded-xl shadow-sm transition-all text-lg active:scale-95"
                >
                  {depo as string}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5. DURUM: YENİ DOSYA YÜKLEME EKRANI (ADMİN SEÇTİĞİNDE) */}
        {hasData && !selectedDepo && viewMode === 'upload' && isAdmin && (
          <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-orange-200 animate-fade-in relative">
            <div className="flex items-center mb-6 border-b pb-4">
              <button
                onClick={() => setViewMode('decision')}
                className="mr-4 text-gray-500 hover:text-gray-800 font-bold hover:underline"
              >
                ← Vazgeç
              </button>
              <h2 className="text-xl font-bold text-gray-800 w-full text-center pr-8">
                Yeni Liste Yükle
              </h2>
            </div>
            <div className="bg-orange-50 text-orange-800 p-4 rounded-lg mb-6 text-sm font-medium border-l-4 border-orange-500">
              ⚠️ <strong>BİLGİ:</strong> Yeni bir Excel dosyası seçip yüklediğiniz anda mevcut tüm sayım verileri silinecektir.
            </div>
            <FileUpload onDataLoaded={handleDataLoaded} />
          </div>
        )}

        {/* 6. DURUM: SAYIM EKRANI */}
        {hasData && selectedDepo && (
          <CountingScreen
            depoName={selectedDepo}
            availableDepolar={getUniqueDepolar() as string[]}
            onSwitchDepo={(newDepo) => setSelectedDepo(newDepo)}
            items={stockData.filter((item: any) => item.Depolar === selectedDepo)}
            onBack={() => setSelectedDepo(null)}
          />
        )}
      </div>

      {/* Modallar */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">⚠️</div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Tüm Veriler Silinecek!</h3>
              <p className="text-sm text-gray-500">Mevcut sayımlar ve depo listesi kalıcı olarak silinecek. Emin misiniz?</p>
            </div>
            <div className="flex space-x-3">
              <button onClick={() => setShowClearModal(false)} className="flex-1 bg-gray-100 text-gray-800 font-bold py-3 rounded-xl">Vazgeç</button>
              <button onClick={handleConfirmClear} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl">Evet, Sıfırla</button>
            </div>
          </div>
        </div>
      )}

      {showLogoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🚪</div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Çıkış Yapıyorsunuz</h3>
            <p className="text-sm text-gray-500 mb-6">Hesabınızdan güvenli çıkış yapmak istiyor musunuz?</p>
            <div className="flex space-x-3">
              <button onClick={() => setShowLogoutModal(false)} className="flex-1 bg-gray-100 text-gray-800 font-bold py-3 rounded-xl">İptal</button>
              <button onClick={handleConfirmLogout} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl">Çıkış Yap</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}