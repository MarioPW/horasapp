/** Parámetros de nómina Colombia. Actualizar SMLMV cada año (Resolución MTESS). */
export const SMLMV = 1_423_500;

export const IBC_CAP_SMMLV = 25; // Tope de ingreso base de cotización

// Recargos (CST art. 55, 56, 57, 59, 168 y 179 · noche 7 p.m.–6 a.m., Ley 1846 de 2017)
export const NIGHT_SURCHARGE = 0.35;
// Extras planas (CST art. 168): no escalan después de la 2.ª hora
export const OT_DIURNAL = { first: 0.25, rest: 0.25, hoursPerDay: 2 };
export const OT_NOCTURNAL = { first: 0.75, rest: 0.75, hoursPerDay: 2 };
// Dominicales/festivos (CST art. 179 · Ley 2466 de 2025, 90% vigente desde jul-2026):
// ordinarias diurnas +90%; ordinarias nocturnas +90% + 35% noche = +125%.
// `overtimeBase` = base dominical común de las extras acumulativas (1 + base + recargo extra).
export const SUNDAY_HOLIDAY = { diurnal: 0.9, nocturnal: 1.25, overtimeBase: 0.9 };
// Escala Ley 2466 de 2025: 80% (jul-2025) → 90% (jul-2026) → 100% (jul-2027):
// en jul-2027 subir `diurnal`/`overtimeBase` a 1 y `nocturnal` a 1.35.

// Prestaciones sociales (proporcional al periodo trabajado)
export const SEVERANCE_RATE = 25 / 300; // Cesantías ~8.33%
export const PRIMA_RATE = 25 / 300; // Prima ~8.33%
export const VACATION_RATE = 15 / 360; // Vacaciones 15 días/año
// Intereses de cesantías: 12% anual (art. 192 CST) → se prorratea por días del rango
export const SEVERANCE_INTEREST_ANNUAL = 0.12;

// Auxilio de transporte
export const TRANSPORT_RATE = 0.1;
export const TRANSPORT_THRESHOLD_SMMLV = 2;

/** Modos de cálculo del auxilio de transporte (usuario lo configura). */
export const TRANSPORT_MODES = [
  { value: 'proporcional', label: 'Proporcional (por días trabajados)', short: 'Proporcional' },
  { value: 'fijo', label: 'Valor mensual fijo (corte completo)', short: 'Fijo mensual' },
  { value: 'ninguno', label: 'No aplica (remoto o ingreso > 2 SMLMV)', short: 'No aplica' },
];

export const getTransportMode = (value) =>
  TRANSPORT_MODES.find((m) => m.value === value) ?? TRANSPORT_MODES[0];

// Jornada ordinaria: 48 h/semana → 8 h/día en 6 días (reducción gradual Ley 2101 de 2021)
export const DAILY_ORDINARY_LIMIT = 8;

// Divisor mensual para derivar la hora desde el salario: 210 h/mes
export const HOURS_PER_MONTH = 210;

/** Tipos de contrato: tasas sugeridas y aplica prestaciones sociales. */
export const CONTRACT_TYPES = [
  { value: 'horas', label: 'Contrato por horas', healthRate: 4, pensionRate: 4, benefits: true },
  { value: 'fijo', label: 'Término fijo', healthRate: 4, pensionRate: 4, benefits: true },
  { value: 'indefinido', label: 'Término indefinido', healthRate: 4, pensionRate: 4, benefits: true },
  {
    value: 'prestacion',
    label: 'Prestación de servicios',
    healthRate: 8.5,
    pensionRate: 12,
    benefits: false,
  },
];

export const getContract = (value) =>
  CONTRACT_TYPES.find((c) => c.value === value) ?? CONTRACT_TYPES[0];
