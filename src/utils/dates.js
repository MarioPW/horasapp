/** Helpers de fecha sin dependencias: fechas como string 'YYYY-MM-DD' (hora local). */
export const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayISO = () => toISODate(new Date());

export const parseISO = (iso) => new Date(`${iso}T00:00:00`);

export const addDaysISO = (iso, days) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

export const isSunday = (iso) => parseISO(iso).getDay() === 0;

export const startOfMonthISO = (iso = todayISO()) => `${iso.slice(0, 8)}01`;

export const isValidISO = (iso) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(parseISO(iso).getTime());
