import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, connectFirestoreEmulator } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
};

export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
const app = firebaseConfigured ? (getApps()[0] ?? initializeApp(config)) : null;
export const auth = app ? getAuth(app) : null;
// The account-scoped durable outbox in persistence.ts owns offline storage.
// Avoid a shared Firestore disk cache retaining a signed-out user's records.
export const db = app ? initializeFirestore(app, { localCache: memoryLocalCache() }) : null;
export const googleProvider = new GoogleAuthProvider();

if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
