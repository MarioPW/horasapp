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

  const nearby = shifts
    .filter((s) => s.id !== excludeId && Math.abs(daysDiff(s.date, date)) <= 1)
    .map((shift) => ({ shift, iv: interval(shift) }))
    .filter((x) => x.iv);

  for (const { shift: existing, iv } of nearby) {
    const when = formatDateShort(existing.date);
    const label = `${existing.startTime} a ${existing.endTime}`;

    // Misma fecha + mismo rango → duplicado
    if (existing.date === date && iv[0] === target[0] && iv[1] === target[1]) {
      return {
        type: 'duplicate',
        existing,
        message: `Ya registraste un turno de ${label} el ${when}: no puedes duplicarlo.`,
      };
    }

    // Traslape en tiempo absoluto (los días vecinos se corren ±24 h)
    const offset = daysDiff(existing.date, date) * 24;
    const cur = [iv[0] + offset, iv[1] + offset];
    if (Math.max(cur[0], target[0]) < Math.min(cur[1], target[1])) {
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
