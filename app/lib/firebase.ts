// app/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  Firestore, // YENİ: TypeScript'e db'nin kimliğini kanıtlamak için Firestore tipini import ettik
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAcg4Smv1dc3AG8Dwj7TExdMuMamKWHQ54',
  authDomain: 'longosphere-sayim.firebaseapp.com',
  projectId: 'longosphere-sayim',
  storageBucket: 'longosphere-sayim.firebasestorage.app',
  messagingSenderId: '928080499199',
  appId: '1:928080499199:web:5abe4d29dee18ae48c17ca',
};

// Singleton Pattern
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);

// CTO Dokunuşu: TypeScript'in "any" hatasını çözmek için db'nin tipini (Firestore) açıkça deklare ediyoruz
let db: Firestore;

if (typeof window !== 'undefined') {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} else {
  db = getFirestore(app);
}

export { app, auth, db };