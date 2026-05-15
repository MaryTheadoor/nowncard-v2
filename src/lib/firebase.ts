import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyC5LYbN48ILp4eXv_6O00dR3ode_9cWE1w',
  authDomain: 'vcard-studio-314.firebaseapp.com',
  projectId: 'vcard-studio-314',
  storageBucket: 'vcard-studio-314.firebasestorage.app',
  messagingSenderId: '58487120224',
  appId: '1:58487120224:web:f53e2cda0f276fd237fe05',
  measurementId: 'G-J5CTHK4GT9',
};

let app;
try {
  app = initializeApp(firebaseConfig);
} catch (err) {
  console.error('[Firebase] Init failed:', err);
  throw new Error('Failed to initialize Firebase. Check your configuration.', { cause: err });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Debug tokens for local dev
if (location.hostname === 'localhost') {
  (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || 'appcheck-debug-token';
}
