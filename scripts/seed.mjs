/**
 * Siembra de datos de prueba (turnos rotativos domingo a domingo).
 * Uso: node scripts/seed.mjs [--email x] [--pass y] [--count 45]
 *
 * Reglas de generación (trabajador rotativo, 6 días trabajados / 1 libre):
 *  - Miércoles libre (día compensatorio entre semana).
 *  - Rotación semanal de turno: mañana 06–14 / tarde 14–22 / noche 22–06.
 *  - Variaciones determinísticas por fecha: sábados largos 08–20 (12 h, extras),
 *    refuerzos de 10 h y domingos largos 08–18.
 *  - Nunca duplica fechas ya registradas.
 */
import { loginWithEmail, registerWithEmail } from '../src/services/auth.js';
import { listShifts, saveShift } from '../src/services/shifts.js';
import { loadUserSettings, saveUserSettings } from '../src/services/userSettings.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const EMAIL = flag('email', 'mariotriana02@hotmail.com');
const PASS = flag('pass', '123456');
const COUNT = Number(flag('count', '45'));

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Hash determinístico por fecha → mismas variaciones en cada ejecución. */
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) >>> 0;

const ROTATION = [
  ['06:00', '14:00'], // semana mañana
  ['14:00', '22:00'], // semana tarde
  ['22:00', '06:00'], // semana noche
];
const EXTENDED = { '06:00': '16:00', '14:00': '23:00', '22:00': '08:00' };

/** Turno de un día: base rotativa + variaciones realistas. */
function shiftFor(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const wd = d.getDay(); // 0 = domingo
  const h = hash(dateStr);
  const weekStart = addDays(d, -wd); // domingo que inicia la semana
  const [start, end] = ROTATION[Math.floor(weekStart.getTime() / 604800000) % 3]; // rotación semanal

  if (wd === 6 && h % 3 === 0) return { startTime: '08:00', endTime: '20:00' }; // sábado largo 12 h
  if (wd === 0 && h % 5 === 0) return { startTime: '08:00', endTime: '18:00' }; // domingo largo 10 h
  if (h % 11 === 4) return { startTime: start, endTime: EXTENDED[start] }; // refuerzo 10 h
  return { startTime: start, endTime: end };
}

/** Fechas candidatas: sin miércoles (compensatorio) y sin turnos ya existentes. */
function candidates(start, end, taken) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const s = iso(d);
    if (d.getDay() === 3) continue; // miércoles libre
    if (taken.has(s)) continue;
    out.push(s);
  }
  return out;
}

/** Reduye a n dejando huecos evenly repartidos (cubre todo el rango, incluido hoy). */
function spread(arr, n) {
  if (arr.length <= n) return arr;
  const dropCount = arr.length - n;
  const step = arr.length / (dropCount + 1);
  const drop = new Set(Array.from({ length: dropCount }, (_, k) => Math.floor((k + 1) * step)));
  return arr.filter((_, i) => !drop.has(i));
}

async function main() {
  // 1. Sesión (registra la cuenta si aún no existe)
  try {
    await loginWithEmail(EMAIL, PASS);
    console.log(`✓ Sesión iniciada: ${EMAIL}`);
  } catch (e) {
    if (e.message.includes('No existe una cuenta')) {
      await registerWithEmail('Mario Ariana', EMAIL, PASS);
      console.log(`✓ Cuenta creada: ${EMAIL}`);
    } else {
      throw e;
    }
  }

  // 2. Datos laborales: solo si aún no existen (no pisa la config real)
  const existingSettings = await loadUserSettings();
  if (existingSettings) {
    console.log(`• Datos laborales ya existen (${existingSettings.contractType}) → intactos`);
  } else {
    await saveUserSettings({
      hourlyRate: 9500,
      healthRate: 4,
      pensionRate: 4,
      contractType: 'indefinido',
      breakMinutes: 60,
    });
    console.log('✓ Datos laborales creados (indefinido, $9.500/h, descanso 60 min)');
  }

  // 3. Turnos: rango creciente hasta cubrir COUNT fechas libres
  const existing = await listShifts();
  const taken = new Set(existing.map((s) => s.date));
  console.log(`• Turnos existentes: ${existing.length}`);

  const today = new Date();
  let back = 60;
  let picks = [];
  while (picks.length < COUNT && back <= 400) {
    const start = addDays(today, -back);
    const free = candidates(start, today, taken);
    picks = spread(free, COUNT);
    if (picks.length < COUNT) back += 30;
  }

  let inserted = 0;
  for (const date of picks) {
    const t = shiftFor(date);
    await saveShift({ date, ...t });
    inserted += 1;
  }

  // 4. Verificación: releer desde Firestore
  const after = await listShifts();
  const mine = after.filter((s) => picks.includes(s.date));
  const sample = mine.slice(0, 5).map((s) => `${s.date} ${s.startTime}→${s.endTime}`);
  console.log(`\n✓ Insertados: ${inserted} turnos (${picks[0]} → ${picks[picks.length - 1]})`);
  console.log(`✓ Total en Firestore: ${after.length}`);
  console.log(`Muestra:\n  ${sample.join('\n  ')}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  });
