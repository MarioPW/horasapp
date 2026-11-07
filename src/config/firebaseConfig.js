/**
 * Firebase config skeleton (Auth + Firestore, modular SDK v9+).
 * Inyecta tus credenciales aquí o define las variables VITE_FIREBASE_* en .env.local.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyCQw-PUSyuAV4JhEsUptvwcBCkEsqAwkH4',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'horasapp-e3710.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'horasapp-e3710',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'horasapp-e3710.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '648139381459',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:648139381459:web:7139e51a1062533c23d226',
  measurementId: "G-KQT1392P83"
};

const placeholder = (value) => !value || String(value).startsWith('YOUR_');

/** false → la app corre en modo demo (solo cálculo local, sin login ni guardado). */
export const isFirebaseConfigured =
  !placeholder(firebaseConfig.apiKey) &&
  !placeholder(firebaseConfig.projectId) &&
  !placeholder(firebaseConfig.appId);
