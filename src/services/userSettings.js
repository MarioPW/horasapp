import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseAuth, firestore, isFirebaseConfigured } from './firebase.js';

const COLLECTION = 'users';

function session() {
  if (!isFirebaseConfigured) throw new Error('Firebase no está configurado.');
  const user = firebaseAuth().currentUser;
  if (!user) throw new Error('Debes iniciar sesión.');
  return user;
}

/** Configuración base del usuario (doc ID = uid). null si no existe aún. */
export async function loadUserSettings() {
  const { uid } = session();
  const snap = await getDoc(doc(firestore(), COLLECTION, uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveUserSettings(settings) {
  const { uid } = session();
  await setDoc(
    doc(firestore(), COLLECTION, uid),
    { ...settings, uid, updatedAt: serverTimestamp() },
    { merge: true },
  );
  return settings;
}
