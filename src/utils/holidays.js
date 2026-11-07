import { addDaysISO, parseISO } from './dates.js';

/** Festivos fijos (no se trasladan). */
const FIXED = ['01-01', '05-01', '07-20', '08-07', '12-08', '12-25'];

/** Festivos trasladables al lunes siguiente (Ley 51/1990). */
const MONDAY_MOVE = ['01-06', '03-19', '10-12', '11-01'];

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const toMonday = (iso) => {
  const dow = parseISO(iso).getDay();
  return dow === 1 ? iso : addDaysISO(iso, (1 - dow + 7) % 7);
};

const cache = new Map();

/** Conjunto de festivos colombianos de un año (aproximación estadutaria; decretos pueden mover alguna fecha). */
export function colombianHolidays(year) {
  if (cache.has(year)) return cache.get(year);
  const set = new Set(FIXED.map((md) => `${year}-${md}`));
  MONDAY_MOVE.forEach((md) => set.add(toMonday(`${year}-${md}`)));

  const easter = easterSunday(year);
  set.add(addDaysISO(easter, -3)); // Jueves Santo
  set.add(addDaysISO(easter, -2)); // Viernes Santo
  set.add(toMonday(addDaysISO(easter, 39))); // Ascensión
  set.add(toMonday(addDaysISO(easter, 60))); // Corpus Christi
  set.add(toMonday(addDaysISO(easter, 68))); // Sagrado Corazón

  cache.set(year, set);
  return set;
}

export const isColombianHoliday = (iso) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) && colombianHolidays(Number(iso.slice(0, 4))).has(iso);
