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

/** Salida vacía → null ("Pendiente"); Firestore guarda `endTime: null`. */
const toDoc = ({ date, startTime, endTime }) => ({
  date,
  startTime,
  endTime: endTime || null,
});

export async function saveShift({ date, startTime, endTime }) {
  const { uid } = session();
  const ref = await addDoc(collection(firestore(), COLLECTION), {
    uid,
    ...toDoc({ date, startTime, endTime }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateShift(id, { date, startTime, endTime }) {
  session();
  await updateDoc(doc(firestore(), COLLECTION, id), {
    ...toDoc({ date, startTime, endTime }),
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
 * @returns {Promise<Array<{ id: string } & Record<string, any>>>}
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
