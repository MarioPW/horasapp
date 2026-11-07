import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from './firebase.js';

const googleProvider = new GoogleAuthProvider();

const MESSAGES = {
  'auth/invalid-email': 'Ingresa un correo válido.',
  'auth/missing-password': 'Ingresa tu contraseña.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'No existe una cuenta con este correo.',
  'auth/email-already-in-use': 'Este correo ya está registrado.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/popup-closed-by-user': 'La ventana se cerró antes de completar el inicio de sesión.',
  'auth/network-request-failed': 'Sin conexión a internet. Intenta de nuevo.',
  'auth/too-many-requests': 'Demasiados intentos. Vuelve a intentar más tarde.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase.',
};

const toAppError = (e) =>
  new Error(MESSAGES[e?.code] ?? e?.message ?? 'No se pudo completar la operación.');

const guard = () => {
  if (!isFirebaseConfigured) throw new Error('Firebase no está configurado.');
};

export async function registerWithEmail(name, email, password) {
  guard();
  try {
    const { user } = await createUserWithEmailAndPassword(firebaseAuth(), email.trim(), password);
    if (name) await updateProfile(user, { displayName: name });
    return user;
  } catch (e) {
    throw toAppError(e);
  }
}

export async function loginWithEmail(email, password) {
  guard();
  try {
    const { user } = await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
    return user;
  } catch (e) {
    throw toAppError(e);
  }
}

export async function loginWithGoogle() {
  guard();
  try {
    const { user } = await signInWithPopup(firebaseAuth(), googleProvider);
    return user;
  } catch (e) {
    if (e?.code === 'auth/popup-closed-by-user') return null;
    throw toAppError(e);
  }
}

export async function logout() {
  guard();
  try {
    await signOut(firebaseAuth());
  } catch (e) {
    throw toAppError(e);
  }
}

/** Suscribe al listener de sesión; devuelve el unsubscribe. Nunca lanza. */
export function watchAuth(callback) {
  if (!isFirebaseConfigured) {
    callback(null);
    return () => {};
  }
  try {
    return onAuthStateChanged(firebaseAuth(), callback, () => callback(null));
  } catch {
    callback(null);
    return () => {};
  }
}
