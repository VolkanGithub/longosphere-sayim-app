// app/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAcg4Smv1dc3AG8Dwj7TExdMuMamKWHQ54',
  authDomain: 'longosphere-sayim.firebaseapp.com',
  projectId: 'longosphere-sayim',
  storageBucket: 'longosphere-sayim.firebasestorage.app',
  messagingSenderId: '928080499199',
  appId: '1:928080499199:web:5abe4d29dee18ae48c17ca',
};

// CTO Dokunuşu: Next.js sayfayı her yenilediğinde Firebase'i baştan başlatıp hata vermesini engelliyoruz (Singleton Pattern)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Kimlik doğrulama (Giriş yapma) ve Veritabanı (Sayım kaydetme) motorlarını çalıştırıyoruz
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
