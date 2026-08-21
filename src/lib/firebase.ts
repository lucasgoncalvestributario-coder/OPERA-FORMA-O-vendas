import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBULwAyVqjGDoTyY9prVqa-VUQWcaZQEHc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0135363209.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0135363209",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0135363209.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "141072856887",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:141072856887:web:3a4550b04d4ca4824e4cb2",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-306eb4ea-4f4a-4650-8509-2de23c6ddae3"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const customDbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  }, customDbId);
} catch (err) {
  console.warn("Failed to initialize Firestore with persistent local cache; falling back to default:", err);
  try {
    firestoreDb = getFirestore(app, customDbId);
  } catch (fallbackErr) {
    console.error("Critical: Failed to get default Firestore instance:", fallbackErr);
    firestoreDb = getFirestore(app);
  }
}

export const db = firestoreDb;
export const auth = getAuth(app);
export default app;
