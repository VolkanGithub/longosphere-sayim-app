'use client';

import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Canlı İnternet Dinleyicisi
  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) return;

    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error(err);
      setError('Giriş başarısız. E-posta veya şifre hatalı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 relative overflow-hidden">

        {/* Offline Uyarı Bandı */}
        {isOffline && (
          <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-center py-2 text-xs font-bold">
            ⚠️ İnternet bağlantısı yok. İlk giriş için bağlantı şarttır.
          </div>
        )}

        <div className={`text-center mb-8 ${isOffline ? 'mt-4' : ''}`}>
          <h1 className="text-3xl font-extrabold text-gray-800">Longosphere</h1>
          <p className="text-gray-500 mt-2">Dijital Depo Yönetimi</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-semibold border border-red-200 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              E-posta Adresi
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isOffline}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${isOffline ? 'bg-gray-100 border-gray-200 text-gray-400' : 'border-gray-300'}`}
              placeholder="ornek@longosphere.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Şifre
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isOffline}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${isOffline ? 'bg-gray-100 border-gray-200 text-gray-400' : 'border-gray-300'}`}
              placeholder="••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || isOffline}
            className={`w-full text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors ${loading || isOffline
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {loading ? 'Giriş Yapılıyor...' : isOffline ? 'Bağlantı Bekleniyor' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}