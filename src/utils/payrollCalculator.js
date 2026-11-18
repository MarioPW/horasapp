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
  SEVERANCE_INTEREST_ANNUAL,
  TRANSPORT_RATE,
  TRANSPORT_THRESHOLD_SMMLV,
  DAILY_ORDINARY_LIMIT,
  HOURS_PER_MONTH,
  getContract,
} from './constants.js';
import { isColombianHoliday } from './holidays.js';
import { isSunday, addDaysISO } from './dates.js';

export const DIURNAL_START = 6; // 6:00 a.m.
export const DIURNAL_END = 19; // 7:00 p.m. (noche 7 p.m.–6 a.m., Ley 1846/2017 · Ley 2466/2025)

/** Ancho de la primera franja de horas extras (2 h/día) — idéntico en diurnas y nocturnas. */
const OT_TIER_HOURS = OT_DIURNAL.hoursPerDay;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const pct = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n / 100 : 0;
};

const r2 = (v) => Math.round(v * 100) / 100;

/** ¿La hora cae en la ventana nocturna (19:00–6:00)? */
const isNight = (h) => h < DIURNAL_START || h >= DIURNAL_END;

/** Días de calendario inclusivos entre dos fechas ISO (NaN si el rango es inválido). */
const daysInclusive = (from, to) => {
  const diff = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  if (!Number.isFinite(diff)) return NaN;
  return Math.round(diff / 86400000) + 1;
};

/**
 * Valor de hora efectivo: si hay salario básico mensual configurado se deriva
 * con el divisor legal (210 h/mes, jornada 42 h/semana); si no, se usa el
 * valor de hora directo.
 */
export function resolveHourlyRate(settings) {
  const s = settings ?? {};
  const monthly = num(s.monthlySalary);
  if (monthly > 0) return Math.round(monthly / HOURS_PER_MONTH);
  return num(s.hourlyRate);
}

/**
 * 'HH:MM' → horas decimales. Estricto: rechaza negativos, horas > 24,
 * minutos fuera de 0–59 y '24:MM' con MM > 0 (solo existe 24:00).
 */
export function timeToHours(time) {
  const raw = String(time ?? '').trim();
  if (!/^\d{1,2}:\d{2}$/.test(raw)) return NaN;
  const [h, m] = raw.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  if (h < 0 || h > 24 || m < 0 || m > 59) return NaN;
  if (h === 24 && m > 0) return NaN;
  return h + m / 60;
}

/** Duración en horas; permite cruce de medianoche (salida < entrada → día siguiente).
 * @param {{ startTime?: string, endTime?: string }} [shift] */
export function computeShiftDuration({ startTime, endTime } = {}) {
  const s = timeToHours(startTime);
  const e = timeToHours(endTime);
  if (!Number.isFinite(s) || !Number.isFinite(e) || s === e) return 0;
  return e > s ? e - s : e + 24 - s;
}

/** Turno sin hora de salida ("Pendiente"): 0 horas pagaderas, nunca NaN. */
export const isPendingShift = (shift) => !shift?.endTime;

/**
 * Duración bruta sugerida al cerrar un turno pendiente con la jornada legal:
 * límite ordinario diario + descanso no pagado, para que queden `limit` h netas.
 */
export function dailySpanHours(settings = null) {
  const s = settings ?? {};
  return (num(s.dailyOrdinaryLimit) || DAILY_ORDINARY_LIMIT) + num(s.breakMinutes) / 60;
}

/**
 * Suma horas a 'HH:MM' con vuelta a las 24 h → 'HH:MM' (salida candidata al
 * cierre automático: 20:00 + 9 h = 05:00 del día siguiente).
 * @returns {string|null} null si la hora o el incremento no son válidos
 */
export function addHoursToTime(time, hours) {
  const start = timeToHours(time);
  if (!Number.isFinite(start) || !Number.isFinite(hours) || hours <= 0) return null;
  const mins = Math.round((start + hours) * 60) % (24 * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/**
 * Corta el tramo [start, end) en trozos según la ventana diurna (6–19) o
 * nocturna (19–6), conservando el orden cronológico.
 * @returns {Array<{ start: number, end: number, night: boolean }>}
 */
function windowSlices(start, end) {
  if (!(end > start)) return [];
  const cuts = [start, end];
  for (const c of [DIURNAL_START, DIURNAL_END]) if (c > start && c < end) cuts.push(c);
  cuts.sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i];
    const b = cuts[i + 1];
    if (b <= a) continue;
    out.push({ start: a, end: b, night: isNight((a + b) / 2) });
  }
  return out;
}

/** Quita el intervalo [bs, be) de una lista de trozos (puede dividirlos). */
function cutInterval(slices, bs, be) {
  if (!(be > bs)) return { slices, removed: 0 };
  let removed = 0;
  const out = [];
  for (const sl of slices) {
    const a = Math.max(sl.start, bs);
    const b = Math.min(sl.end, be);
    if (b <= a) {
      out.push(sl);
      continue;
    }
    removed += b - a;
    if (a > sl.start) out.push({ ...sl, end: a });
    if (b < sl.end) out.push({ ...sl, start: b });
  }
  return { slices: out, removed };
}

/** Descanso no pagado por jornada: primero de las horas diurnas, luego nocturnas. */
function applyBreak(slices, breakHours) {
  let remaining = breakHours;
  const out = slices.map((sl) => ({ ...sl }));
  for (const nightPass of [false, true]) {
    for (const sl of out) {
      if (remaining <= 0) break;
      if (sl.night !== nightPass) continue;
      const take = Math.min(remaining, sl.end - sl.start);
      sl.start += take;
      remaining -= take;
    }
  }
  return out.filter((sl) => sl.end > sl.start);
}

/**
 * Enriquece un turno: duración, segmentos por fecha (cruce de medianoche →
 * día 1 + día 2, cada uno evaluando domingo/festivo por separado), trozos
 * cronológicos día/noche y descanso explícito ya descontado.
 * @param {Record<string, any>} [shift]
 * @returns {Record<string, any>}
 */
export function describeShift(shift = {}) {
  const duration = computeShiftDuration(shift);
  const s = timeToHours(shift.startTime);
  const e = timeToHours(shift.endTime);
  const date = String(shift.date ?? '');

  const segments = [];
  if (duration > 0 && date) {
    if (e < s) {
      // Cruce de medianoche: [s, 24) en la fecha de inicio y [0, e) al día siguiente
      segments.push({ date, offset: 0, start: s, end: 24 });
      if (e > 0) segments.push({ date: addDaysISO(date, 1), offset: 24, start: 0, end: e });
    } else {
      segments.push({ date, offset: 0, start: s, end: e });
    }
  }

  // Descanso explícito (breakStart/breakEnd) si el turno lo trae: se descuenta aquí
  const bs = timeToHours(shift.breakStart);
  const be = timeToHours(shift.breakEnd);
  const hasBreak = Number.isFinite(bs) && Number.isFinite(be) && (be > bs || be + 24 > bs);
  const breakEndAbs = hasBreak && be <= bs ? be + 24 : be;

  const out = segments.map((seg) => {
    let slices = windowSlices(seg.start, seg.end);
    let breakHours = 0;
    if (hasBreak) {
      const cut = cutInterval(slices, bs - seg.offset, breakEndAbs - seg.offset);
      slices = cut.slices;
      breakHours = r2(cut.removed);
    }
    const diurnal = slices.filter((x) => !x.night).reduce((t, x) => t + (x.end - x.start), 0);
    const nocturnal = slices.filter((x) => x.night).reduce((t, x) => t + (x.end - x.start), 0);
    return {
      date: seg.date,
      start: seg.start,
      end: seg.end,
      hours: r2(seg.end - seg.start - breakHours),
      diurnal: r2(diurnal),
      nocturnal: r2(nocturnal),
      breakHours,
      isSunday: isSunday(seg.date),
      isHoliday: isColombianHoliday(seg.date),
      slices,
    };
  });

  const diurnal = out.reduce((t, x) => t + x.diurnal, 0);
  const nocturnal = out.reduce((t, x) => t + x.nocturnal, 0);

  return {
    ...shift,
    duration: r2(duration),
    diurnal: r2(diurnal),
    nocturnal: r2(nocturnal),
    // Flags del primer día del turno (compatibilidad); por fecha → segments[]
    isSunday: out[0]?.isSunday ?? isSunday(date),
    isHoliday: out[0]?.isHoliday ?? isColombianHoliday(date),
    segments: out,
  };
}

/**
 * Agrupa turnos por fecha: totales de horas, flags de domingo/festivo y trozos
 * cronológicos por día (un turno que cruza medianoche aporta a dos fechas).
 */
export function aggregateShifts(shifts = []) {
  const byDate = new Map();
  for (const raw of shifts) {
    const d = describeShift(raw);
    for (const seg of d.segments) {
      if (seg.hours <= 0 && seg.slices.length === 0) continue;
      const cur = byDate.get(seg.date) ?? {
        date: seg.date,
        total: 0,
        diurnal: 0,
        nocturnal: 0,
        breakHours: 0,
        isSunday: seg.isSunday,
        isHoliday: seg.isHoliday,
        slices: [],
      };
      cur.total += seg.hours;
      cur.diurnal += seg.diurnal;
      cur.nocturnal += seg.nocturnal;
      cur.breakHours += seg.breakHours;
      cur.slices.push(...seg.slices);
      byDate.set(seg.date, cur);
    }
  }
  return [...byDate.values()]
    .map((day) => ({
      ...day,
      total: r2(day.total),
      diurnal: r2(day.diurnal),
      nocturnal: r2(day.nocturnal),
      breakHours: r2(day.breakHours),
      slices: day.slices.sort((a, b) => a.start - b.start),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Suma de horas de una lista de turnos. */
export function totalHours(shifts = []) {
  return r2(shifts.reduce((sum, s) => sum + computeShiftDuration(s), 0));
}

/**
 * Calcula la nómina de un rango de fechas a partir de turnos reales.
 * Función pura: turnos + configuración → desglose completo.
 *
 * Reglas:
 * - Turnos sin salida (`endTime` null, "Pendiente") no generan horas (0 h, sin
 *   NaN) y se reportan en `meta.pendingShifts` para completarlos desde la UI.
 * - Clasificación cronológica: primeras `dailyOrdinaryLimit` h/día (8 por
 *   defecto) = ordinarias; el excedente son extras planas (CST art. 168):
 *   diurnas +25% y nocturnas +75%, sin escalonado por hora.
 * - Noche (19:00–6:00) +35% sobre ordinarias; domingo/festivo (CST art. 179 ·
 *   Ley 2466 de 2025) +90% diurno y +125% nocturno, y sus extras acumulan la
 *   base dominical (90%) + el recargo de extra.
 * - Descanso no pagado: de las horas diurnas primero (o intervalo explícito).
 * - Auxilio de transporte contra el salario base (≤ 2 SMLMV), no contra el
 *   devengado, para que las extras no quiten la elegibilidad.
 * - Cesantías y prima con base en devengados + auxilio; vacaciones solo sobre
 *   la base ordinaria; intereses de cesantías 12% anual prorrateado por días.
 * - Salud/pensión sobre IBC (tope 25 SMLMV); prestaciones solo en contratos
 *   laborales.
 */
export function calculateRangePayroll({ shifts = [], settings = null, from = null, to = null } = {}) {
  const s = settings ?? {};
  const contract = getContract(s.contractType);
  const rate = resolveHourlyRate(s); // salario mensual (÷210) o valor de hora directo
  const health = pct(s.healthRate);
  const pension = pct(s.pensionRate);
  const breakPerDay = num(s.breakMinutes) / 60; // descanso diario no pagado
  const dailyLimit = num(s.dailyOrdinaryLimit) || DAILY_ORDINARY_LIMIT;

  const inRange = shifts.filter((sh) => (!from || sh.date >= from) && (!to || sh.date <= to));
  // Pendientes (checkOut null): no generan horas, solo metadata en `meta.pending*`
  const pendingShifts = inRange.filter((sh) => isPendingShift(sh));
  const days = aggregateShifts(inRange);

  const acc = {
    ordD: 0,
    ordN: 0,
    sunD: 0,
    sunN: 0,
    otFirstD: 0,
    otFirstN: 0,
    otRestD: 0,
    otRestN: 0,
    sunOtFirstD: 0,
    sunOtFirstN: 0,
    sunOtRestD: 0,
    sunOtRestN: 0,
    overtime: 0,
    sundayHolidayOvertime: 0,
  };

  let breakDeducted = 0;

  for (const day of days) {
    const sunday = day.isSunday || day.isHoliday;
    // El intervalo explícito ya salió de los trozos; si no hay, aplica el diario
    const extraCut = day.breakHours > 0 ? 0 : Math.min(breakPerDay, day.total);
    const slices = applyBreak(day.slices, extraCut);
    breakDeducted += day.breakHours + extraCut;

    let consumed = 0; // horas cronológicas ya clasificadas del día
    let otDone = 0; // horas extras acumuladas (define la franja first/rest)
    for (const sl of slices) {
      const h = sl.end - sl.start;
      if (h <= 0) continue;
      const ordinary = Math.max(0, Math.min(h, dailyLimit - consumed));
      consumed += h;
      const overtime = h - ordinary;

      if (ordinary > 0) {
        if (sunday) {
          if (sl.night) acc.sunN += ordinary;
          else acc.sunD += ordinary;
        } else if (sl.night) acc.ordN += ordinary;
        else acc.ordD += ordinary;
      }

      if (overtime > 0) {
        const first = Math.min(overtime, Math.max(0, OT_TIER_HOURS - otDone));
        const rest = overtime - first;
        otDone += overtime;
        if (sunday) {
          if (sl.night) {
            acc.sunOtFirstN += first;
            acc.sunOtRestN += rest;
          } else {
            acc.sunOtFirstD += first;
            acc.sunOtRestD += rest;
          }
          acc.sundayHolidayOvertime += overtime;
        } else {
          if (sl.night) {
            acc.otFirstN += first;
            acc.otRestN += rest;
          } else {
            acc.otFirstD += first;
            acc.otRestD += rest;
          }
          acc.overtime += overtime;
        }
      }
    }
  }

  const earnings = {
    ordinaryDiurnal: r2(rate * acc.ordD),
    ordinaryNocturnal: r2(rate * (1 + NIGHT_SURCHARGE) * acc.ordN),
    overtimeDiurnal: r2(
      rate * (acc.otFirstD * (1 + OT_DIURNAL.first) + acc.otRestD * (1 + OT_DIURNAL.rest)),
    ),
    overtimeNocturnal: r2(
      rate * (acc.otFirstN * (1 + OT_NOCTURNAL.first) + acc.otRestN * (1 + OT_NOCTURNAL.rest)),
    ),
    sundayHolidayDiurnal: r2(rate * (1 + SUNDAY_HOLIDAY.diurnal) * acc.sunD),
    sundayHolidayNocturnal: r2(rate * (1 + SUNDAY_HOLIDAY.nocturnal) * acc.sunN),
    // Extras en domingo/festivo: base dominical (90%) + recargo de extra (acumulativo)
    sundayHolidayOvertimeDiurnal: r2(
      rate *
        (acc.sunOtFirstD * (1 + SUNDAY_HOLIDAY.overtimeBase + OT_DIURNAL.first) +
          acc.sunOtRestD * (1 + SUNDAY_HOLIDAY.overtimeBase + OT_DIURNAL.rest)),
    ),
    sundayHolidayOvertimeNocturnal: r2(
      rate *
        (acc.sunOtFirstN * (1 + SUNDAY_HOLIDAY.overtimeBase + OT_NOCTURNAL.first) +
          acc.sunOtRestN * (1 + SUNDAY_HOLIDAY.overtimeBase + OT_NOCTURNAL.rest)),
    ),
    transportAllowance: 0,
  };

  const grossExcludingTransport =
    earnings.ordinaryDiurnal +
    earnings.ordinaryNocturnal +
    earnings.overtimeDiurnal +
    earnings.overtimeNocturnal +
    earnings.sundayHolidayDiurnal +
    earnings.sundayHolidayNocturnal +
    earnings.sundayHolidayOvertimeDiurnal +
    earnings.sundayHolidayOvertimeNocturnal;

  // Auxilio: se evalúa contra el salario BASE (mensual o hora × 210), nunca
  // contra el devengado, para que las extras no quiten la elegibilidad.
  const baseSalary = num(s.monthlySalary) > 0 ? num(s.monthlySalary) : rate * HOURS_PER_MONTH;
  const transportMode = s.transportMode;
  if (
    contract.benefits &&
    transportMode !== 'ninguno' &&
    baseSalary <= TRANSPORT_THRESHOLD_SMMLV * SMLMV
  ) {
    const monthly = TRANSPORT_RATE * SMLMV;
    earnings.transportAllowance =
      transportMode === 'fijo' ? r2(monthly) : r2((monthly / 30) * days.length);
  }
  earnings.total = r2(grossExcludingTransport + earnings.transportAllowance);

  const ibc = r2(Math.min(grossExcludingTransport, IBC_CAP_SMMLV * SMLMV));
  const deductions = { health: r2(ibc * health), pension: r2(ibc * pension) };
  deductions.total = r2(deductions.health + deductions.pension);

  // Bases legales: cesantías/prima = devengados + auxilio de transporte;
  // vacaciones = solo base ordinaria (sin extras ni recargos dominicales/festivos)
  const benefitsBase = grossExcludingTransport + earnings.transportAllowance;
  const ordinaryBase = earnings.ordinaryDiurnal + earnings.ordinaryNocturnal;
  const rangeDays = daysInclusive(from ?? '', to ?? '') || days.length;

  const benefits = { severance: 0, severanceInterest: 0, prima: 0, vacation: 0, total: 0 };
  if (contract.benefits) {
    benefits.severance = r2(benefitsBase * SEVERANCE_RATE);
    benefits.prima = r2(benefitsBase * PRIMA_RATE);
    benefits.vacation = r2(ordinaryBase * VACATION_RATE);
    // Art. 192 CST: 12% anual, prorrateado por los días del periodo (360)
    benefits.severanceInterest = r2(
      benefits.severance * SEVERANCE_INTEREST_ANNUAL * (rangeDays / 360),
    );
    benefits.total = r2(
      benefits.severance + benefits.prima + benefits.vacation + benefits.severanceInterest,
    );
  }

  const hours = {
    ordinary: r2(acc.ordD + acc.ordN),
    overtime: r2(acc.otFirstD + acc.otFirstN + acc.otRestD + acc.otRestN),
    sundayHoliday: r2(acc.sunD + acc.sunN),
    sundayHolidayOvertime: r2(acc.sunOtFirstD + acc.sunOtFirstN + acc.sunOtRestD + acc.sunOtRestN),
    byCategory: {
      ordinaryDiurnal: r2(acc.ordD),
      ordinaryNocturnal: r2(acc.ordN),
      overtimeDiurnal: r2(acc.otFirstD + acc.otRestD),
      overtimeNocturnal: r2(acc.otFirstN + acc.otRestN),
      sundayHolidayDiurnal: r2(acc.sunD),
      sundayHolidayNocturnal: r2(acc.sunN),
      sundayHolidayOvertimeDiurnal: r2(acc.sunOtFirstD + acc.sunOtRestD),
      sundayHolidayOvertimeNocturnal: r2(acc.sunOtFirstN + acc.sunOtRestN),
      transportAllowance: 0,
    },
  };
  hours.total = r2(hours.ordinary + hours.overtime + hours.sundayHoliday + hours.sundayHolidayOvertime);
  hours.break = r2(breakDeducted);

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
      pendingCount: pendingShifts.length,
      pendingShifts: pendingShifts.map((sh) => ({
        id: sh.id,
        date: sh.date,
        startTime: sh.startTime,
      })),
      daysWorked: days.length,
      contractType: contract.value,
      // Datos laborales usados en este cálculo (snapshot para mostrar en el resumen)
      hourlyRate: rate,
      monthlySalary: num(s.monthlySalary),
      baseSalary: r2(baseSalary),
      dailyOrdinaryLimit: dailyLimit,
      healthRate: num(s.healthRate),
      pensionRate: num(s.pensionRate),
      breakMinutes: num(s.breakMinutes),
      breakHoursDeducted: r2(breakDeducted),
      transportMode,
      transportDays: days.length,
      rangeDays,
    },
  };
}
