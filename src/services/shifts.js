import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { firebaseAuth, firestore, isFirebaseConfigured } from './firebase.js';

const COLLECTION = 'shifts';

function session() {
  if (!isFirebaseConfigured) throw new Error('Firebase no está configurado.');
  const user = firebaseAuth().currentUser;
  if (!user) throw new Error('Debes iniciar sesión para gestionar turnos.');
  return user;
}

const byDateDesc = (a, b) => String(b.date).localeCompare(String(a.date));

export async function saveShift({ date, startTime, endTime }) {
  const { uid } = session();
  const ref = await addDoc(collection(firestore(), COLLECTION), {
    uid,
    date,
    startTime,
    endTime,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateShift(id, { date, startTime, endTime }) {
  session();
  await updateDoc(doc(firestore(), COLLECTION, id), {
    date,
    startTime,
    endTime,
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function deleteShift(id) {
  session();
  await deleteDoc(doc(firestore(), COLLECTION, id));
  return id;
}

/**
 * Todos los turnos del usuario autenticado (ordenados en cliente para
 * evitar índices compuestos en Firestore).
 */
export async function listShifts() {
  const { uid } = session();
  const snap = await getDocs(query(collection(firestore(), COLLECTION), where('uid', '==', uid)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort(byDateDesc);
}

/** Turnos dentro de un rango [from, to] (YYYY-MM-DD, inclusivo). */
export async function listShiftsInRange(from, to) {
  const shifts = await listShifts();
  return shifts.filter((s) => s.date >= from && s.date <= to);
}
