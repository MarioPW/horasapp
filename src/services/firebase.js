import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from '../config/firebaseConfig.js';

let app;

/** Inicialización perezosa: nunca se toca Firebase si no está configurado. */
function ensureApp() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase no está configurado. Completa src/config/firebaseConfig.js');
  }
  if (!app) app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return app;
}

export const firebaseAuth = () => getAuth(ensureApp());
export const firestore = () => getFirestore(ensureApp());
export { isFirebaseConfigured };
