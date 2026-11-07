/** Parámetros de nómina Colombia. Actualizar SMLMV cada año (Resolución MTESS). */
export const SMLMV = 1_423_500;

export const IBC_CAP_SMMLV = 25; // Tope de ingreso base de cotización

// Recargos (CST art. 56, 57, 59 · Ley 2101/2016: noche 7 p.m.–6 a.m.)
export const NIGHT_SURCHARGE = 0.35;
export const OT_DIURNAL = { first: 0.25, rest: 0.5, hoursPerDay: 2 };
export const OT_NOCTURNAL = { first: 0.75, rest: 1, hoursPerDay: 2 };
export const SUNDAY_HOLIDAY = { diurnal: 0.25, nocturnal: 0.75 };

// Prestaciones sociales (proporcional al periodo trabajado)
export const SEVERANCE_RATE = 25 / 300; // Cesantías ~8.33%
export const PRIMA_RATE = 25 / 300; // Prima ~8.33%
export const VACATION_RATE = 15 / 360; // Vacaciones 15 días/año
export const SEVERANCE_INTEREST_MONTHLY = 0.01; // 12% anual sobre cesantías

// Auxilio de transporte
export const TRANSPORT_RATE = 0.1;
export const TRANSPORT_THRESHOLD_SMMLV = 2;

// Jornada ordinaria: 48 h/semana → 8 h/día en 6 días (Ley 2101/2016)
export const DAILY_ORDINARY_LIMIT = 8;

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

export const DEFAULT_SETTINGS = {
  hourlyRate: 8000,
  healthRate: 4,
  pensionRate: 4,
  contractType: 'horas',
};
