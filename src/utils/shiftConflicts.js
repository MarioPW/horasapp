import { computeShiftDuration, timeToHours } from './payrollCalculator.js';
import { formatDateShort } from './format.js';

/** [inicio, fin) en horas desde las 00:00 de su fecha (fin > 24 si cruza medianoche). */
const interval = (shift) => {
  const start = timeToHours(shift?.startTime);
  const duration = computeShiftDuration(shift);
  if (!Number.isFinite(start) || duration <= 0) return null;
  return [start, start + duration];
};

/** Diferencia en días entre dos fechas ISO (UTC → estable con horario de verano). */
const daysDiff = (iso, base) =>
  Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${base}T00:00:00Z`)) / 86400000);

/** Turnos vecinos (±1 día, para turnos que cruzan medianoche) con intervalo válido. */
const nearbyIntervals = (shifts, date, excludeId) =>
  shifts
    .filter((s) => s.id !== excludeId && Math.abs(daysDiff(s.date, date)) <= 1)
    .map((shift) => ({ shift, iv: interval(shift) }))
    .filter((x) => x.iv);

/** ¿Los intervalos se cruzan? (medio abierto: [a, b) y [c, d) tocan sin solapar). */
const isOverlap = (iv, target, offset) =>
  Math.max(iv[0] + offset, target[0]) < Math.min(iv[1] + offset, target[1]);

const describe = (existing) => ({
  when: formatDateShort(existing.date),
  label: `${existing.startTime} a ${existing.endTime}`,
});

/**
 * Validador reutilizable de solape entre el candidato [checkIn, checkOut] y los
 * turnos ya registrados (cruce de medianoche: los turnos de días ±1 se corren
 * ±24 h). Solo traslape —sin la regla de "un turno por día"— → sirve para
 * cerrar o editar un turno pendiente que ya tiene un turno posterior.
 *
 * @param {{ shifts?: Array<Record<string, any>>, date?: string, startTime?: string,
 *           endTime?: string, excludeId?: string|null }} [opts]
 * @returns {null | { type: 'overlap', existing: Record<string, any>, message: string }}
 */
export function findOverlapConflict({
  shifts = [],
  date,
  startTime,
  endTime,
  excludeId = null,
} = {}) {
  const target = interval({ startTime, endTime });
  if (!date || !target) return null;

  for (const { shift: existing, iv } of nearbyIntervals(shifts, date, excludeId)) {
    if (!isOverlap(iv, target, daysDiff(existing.date, date) * 24)) continue;
    const { when, label } = describe(existing);
    const relation = iv[0] + daysDiff(existing.date, date) * 24 >= target[0] ? 'siguiente' : 'anterior';
    return {
      type: 'overlap',
      existing,
      message: `La salida ${endTime} se solapa con tu turno ${relation} (${label} del ${when}). Ajusta la hora de salida o edita primero ese turno.`,
    };
  }
  return null;
}

/**
 * Valida un turno contra los ya registrados (uno por jornada + sin solapes).
 *
 * - 'duplicate': horario idéntico al existente en la misma fecha
 * - 'overlap':   el rango nuevo cruja con uno existente (incluye turnos de días
 *                vecinos que cruzan medianoche, p. ej. 22:00→06:00)
 * - 'exists':    ya hay otro turno válido ese día (sin cruce de horas)
 *
 * `excludeId` ignora el turno en edición para no auto-colisionar.
 * Función pura: turnos + candidato → conflicto con mensaje amigable.
 *
 * @param {{ shifts?: Array<Record<string, any>>, date?: string, startTime?: string,
 *           endTime?: string, excludeId?: string|null }} [opts]
 */
export function findDayConflict({
  shifts = [],
  date,
  startTime,
  endTime,
  excludeId = null,
} = {}) {
  const target = interval({ startTime, endTime });
  if (!date || !target) return null;

  const nearby = nearbyIntervals(shifts, date, excludeId);

  for (const { shift: existing, iv } of nearby) {
    const { when, label } = describe(existing);

    // Misma fecha + mismo rango → duplicado
    if (existing.date === date && iv[0] === target[0] && iv[1] === target[1]) {
      return {
        type: 'duplicate',
        existing,
        message: `Ya registraste un turno de ${label} el ${when}: no puedes duplicarlo.`,
      };
    }

    // Traslape en tiempo absoluto (los días vecinos se corren ±24 h)
    if (isOverlap(iv, target, daysDiff(existing.date, date) * 24)) {
      return {
        type: 'overlap',
        existing,
        message: `El horario ${startTime} a ${endTime} se solapa con tu turno de ${label} (${when}).`,
      };
    }
  }

  // Un turno por día: cualquier otro turno válido en la fecha bloquea
  const sameDay = nearby.filter((x) => x.shift.date === date);
  if (sameDay.length > 0) {
    const e = sameDay[0].shift;
    return {
      type: 'exists',
      existing: e,
      message: `Ya tienes un turno el ${formatDateShort(date)} (${e.startTime} a ${e.endTime}). Solo uno por día: edítalo desde Historial.`,
    };
  }
  return null;
}
