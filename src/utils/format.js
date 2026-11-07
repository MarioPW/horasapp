const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const num = (digits) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: digits });

const safe = (value) => (Number.isFinite(+value) ? +value : 0);

export const formatCOP = (value) => cop.format(safe(value));

export const formatNumber = (value, digits = 1) => num(digits).format(safe(value));

/** Horas: entero limpio (12 h) · no entero con un decimal (7.4 h / 6.5 h). */
export const formatHours = (value) => {
  const v = Number.isFinite(+value) ? +value : 0;
  const whole = Math.abs(v - Math.round(v)) < 1e-9; // tolera ruido de punto flotante
  return `${whole ? Math.round(v) : v.toFixed(1)} h`;
};

export const formatPercent = (value, digits = 2) => `${num(digits).format(safe(value))}%`;

const MONTHS_SHORT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** '07 nov' — fecha compacta para filas de una sola línea. */
export const formatDateShort = (iso) => {
  const month = MONTHS_SHORT[Number(iso.slice(5, 7)) - 1] ?? '';
  return `${iso.slice(8, 10)} ${month}`.trim();
};

/** 'sáb' — día de la semana abreviado. */
export const formatDayAbbr = (iso) =>
  new Intl.DateTimeFormat('es-CO', { weekday: 'short' })
    .format(new Date(`${iso}T00:00:00`))
    .replace('.', '');

export const formatDayName = (iso) =>
  new Intl.DateTimeFormat('es-CO', { weekday: 'long' })
    .format(new Date(`${iso}T00:00:00`))
    .replace(/^\w/, (c) => c.toUpperCase());
