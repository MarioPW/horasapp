import {
  SMLMV,
  IBC_CAP_SMMLV,
  NIGHT_SURCHARGE,
  OT_DIURNAL,
  OT_NOCTURNAL,
  SUNDAY_HOLIDAY,
  SEVERANCE_RATE,
  PRIMA_RATE,
  VACATION_RATE,
  SEVERANCE_INTEREST_MONTHLY,
  TRANSPORT_RATE,
  TRANSPORT_THRESHOLD_SMMLV,
  DAILY_ORDINARY_LIMIT,
  DEFAULT_SETTINGS,
  getContract,
} from './constants.js';
import { isColombianHoliday } from './holidays.js';
import { isSunday } from './dates.js';

const DIURNAL_START = 6; // 6 a.m.
const DIURNAL_END = 19; // 7 p.m. (noche 7 p.m.–6 a.m., Ley 2101/2016)

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const pct = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n / 100 : 0;
};

const r2 = (v) => Math.round(v * 100) / 100;

const overlap = (a1, a2, b1, b2) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

/** 'HH:MM' → horas decimales. */
export function timeToHours(time) {
  const [h, m] = String(time ?? '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 24 || m > 59) return NaN;
  return h + m / 60;
}

/** Duración en horas; permite cruce de medianoche (salida < entrada → día siguiente). */
export function computeShiftDuration({ startTime, endTime } = {}) {
  const s = timeToHours(startTime);
  const e = timeToHours(endTime);
  if (!Number.isFinite(s) || !Number.isFinite(e) || s === e) return 0;
  return e > s ? e - s : e + 24 - s;
}

/** Reparte un tramo [start, end] en horas diurnas (6–19) y nocturnas (19–6). */
function splitSegments(start, end) {
  let diurnal = 0;
  let nocturnal = 0;
  for (let k = -1; k <= 2; k++) {
    const base = 24 * k;
    diurnal += overlap(start, end, DIURNAL_START + base, DIURNAL_END + base);
    nocturnal += overlap(start, end, DIURNAL_END + base, DIURNAL_START + 24 + base);
  }
  return { diurnal, nocturnal };
}

/** Enriquece un turno con duración, segmentos día/noche y flags de descanso/festivo. */
export function describeShift(shift = {}) {
  const duration = computeShiftDuration(shift);
  const s = timeToHours(shift.startTime);
  const e = timeToHours(shift.endTime);
  const end = Number.isFinite(s) && Number.isFinite(e) && duration > 0
    ? (e > s ? e : e + 24)
    : NaN;
  const segments = Number.isFinite(end) ? splitSegments(s, end) : { diurnal: 0, nocturnal: 0 };
  const date = String(shift.date ?? '');

  return {
    ...shift,
    duration: r2(duration),
    diurnal: r2(segments.diurnal),
    nocturnal: r2(segments.nocturnal),
    isSunday: isSunday(date),
    isHoliday: isColombianHoliday(date),
  };
}

/** Agrupa turnos por fecha: totales de horas por día, ordenado cronológicamente. */
export function aggregateShifts(shifts = []) {
  const byDate = new Map();
  for (const raw of shifts) {
    const d = describeShift(raw);
    if (d.duration <= 0 || !d.date) continue;
    const cur = byDate.get(d.date) ?? {
      date: d.date,
      total: 0,
      diurnal: 0,
      nocturnal: 0,
      isSunday: d.isSunday,
      isHoliday: d.isHoliday,
    };
    cur.total += d.duration;
    cur.diurnal += d.diurnal;
    cur.nocturnal += d.nocturnal;
    byDate.set(d.date, cur);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Suma de horas de una lista de turnos. */
export function totalHours(shifts = []) {
  return r2(shifts.reduce((sum, s) => sum + computeShiftDuration(s), 0));
}

/**
 * Calcula la nómina de un rango de fechas a partir de turnos reales.
 * Función pura: turnos + configuración → desglose completo.
 *
 * Reglas: 8 h/día ordinarias; excedente = horas extras progresivas (2 h al recargo
 * base, resto al mayor); noche +35%; domingo/festivo +25% diurno / +75% nocturno;
 * salud/pensión según configuración del usuario con tope de 25 SMLMV;
 * prestaciones solo en contratos laborales.
 */
export function calculateRangePayroll({ shifts = [], settings = {}, from = null, to = null } = {}) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const contract = getContract(s.contractType);
  const rate = num(s.hourlyRate);
  const health = pct(s.healthRate);
  const pension = pct(s.pensionRate);

  const inRange = shifts.filter((sh) => (!from || sh.date >= from) && (!to || sh.date <= to));
  const days = aggregateShifts(inRange);

  const acc = {
    ordD: 0,
    ordN: 0,
    sunD: 0,
    sunN: 0,
    otD: 0,
    otN: 0,
    otPayD: 0,
    otPayN: 0,
    overtime: 0,
  };

  for (const day of days) {
    const total = day.total;
    const ordinary = Math.min(total, DAILY_ORDINARY_LIMIT);
    const overtime = Math.max(0, total - DAILY_ORDINARY_LIMIT);
    const ordRatio = total > 0 ? ordinary / total : 0;
    const otRatio = 1 - ordRatio;
    const ordD = day.diurnal * ordRatio;
    const ordN = day.nocturnal * ordRatio;
    const otD = day.diurnal * otRatio;
    const otN = day.nocturnal * otRatio;

    if (day.isSunday || day.isHoliday) {
      acc.sunD += ordD;
      acc.sunN += ordN;
    } else {
      acc.ordD += ordD;
      acc.ordN += ordN;
    }

    if (overtime > 0) {
      // Recargo progresivo: primeras 2 h/día al recargo base (prorrateo día/noche)
      const baseShare = Math.min(overtime, OT_DIURNAL.hoursPerDay) / overtime;
      const restShare = 1 - baseShare;
      acc.otD += otD;
      acc.otN += otN;
      acc.overtime += overtime;
      acc.otPayD += rate * otD * (baseShare * (1 + OT_DIURNAL.first) + restShare * (1 + OT_DIURNAL.rest));
      acc.otPayN +=
        rate * otN * (baseShare * (1 + OT_NOCTURNAL.first) + restShare * (1 + OT_NOCTURNAL.rest));
    }
  }

  const earnings = {
    ordinaryDiurnal: r2(rate * acc.ordD),
    ordinaryNocturnal: r2(rate * (1 + NIGHT_SURCHARGE) * acc.ordN),
    overtimeDiurnal: r2(acc.otPayD),
    overtimeNocturnal: r2(acc.otPayN),
    sundayHolidayDiurnal: r2(rate * (1 + SUNDAY_HOLIDAY.diurnal) * acc.sunD),
    sundayHolidayNocturnal: r2(rate * (1 + SUNDAY_HOLIDAY.nocturnal) * acc.sunN),
    transportAllowance: 0,
  };

  const grossExcludingTransport =
    earnings.ordinaryDiurnal +
    earnings.ordinaryNocturnal +
    earnings.overtimeDiurnal +
    earnings.overtimeNocturnal +
    earnings.sundayHolidayDiurnal +
    earnings.sundayHolidayNocturnal;

  // Auxilio de transporte: solo contratos laborales con ingreso ≤ 2 SMLMV
  if (contract.benefits && grossExcludingTransport <= TRANSPORT_THRESHOLD_SMMLV * SMLMV) {
    earnings.transportAllowance = r2(TRANSPORT_RATE * SMLMV);
  }
  earnings.total = r2(grossExcludingTransport + earnings.transportAllowance);

  const ibc = r2(Math.min(grossExcludingTransport, IBC_CAP_SMMLV * SMLMV));
  const deductions = { health: r2(ibc * health), pension: r2(ibc * pension) };
  deductions.total = r2(deductions.health + deductions.pension);

  const benefits = { severance: 0, severanceInterest: 0, prima: 0, vacation: 0, total: 0 };
  if (contract.benefits) {
    benefits.severance = r2(grossExcludingTransport * SEVERANCE_RATE);
    benefits.prima = r2(grossExcludingTransport * PRIMA_RATE);
    benefits.vacation = r2(grossExcludingTransport * VACATION_RATE);
    benefits.severanceInterest = r2(benefits.severance * SEVERANCE_INTEREST_MONTHLY);
    benefits.total = r2(
      benefits.severance + benefits.prima + benefits.vacation + benefits.severanceInterest,
    );
  }

  const hours = {
    ordinary: r2(acc.ordD + acc.ordN),
    overtime: r2(acc.otD + acc.otN),
    sundayHoliday: r2(acc.sunD + acc.sunN),
    byCategory: {
      ordinaryDiurnal: r2(acc.ordD),
      ordinaryNocturnal: r2(acc.ordN),
      overtimeDiurnal: r2(acc.otD),
      overtimeNocturnal: r2(acc.otN),
      sundayHolidayDiurnal: r2(acc.sunD),
      sundayHolidayNocturnal: r2(acc.sunN),
      transportAllowance: 0,
    },
  };
  hours.total = r2(hours.ordinary + hours.overtime + hours.sundayHoliday);

  const net = r2(earnings.total - deductions.total);

  return {
    earnings,
    deductions,
    benefits,
    hours,
    totals: {
      gross: earnings.total,
      ibc,
      net,
      effectiveHourlyRate: hours.total > 0 ? r2(net / hours.total) : 0,
    },
    meta: {
      from,
      to,
      shiftCount: inRange.filter((sh) => computeShiftDuration(sh) > 0).length,
      daysWorked: days.length,
      contractType: contract.value,
    },
  };
}
