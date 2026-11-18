import { describe, it, expect } from 'vitest';
import {
  timeToHours,
  describeShift,
  calculateRangePayroll,
  isPendingShift,
  addHoursToTime,
  dailySpanHours,
} from './payrollCalculator.js';
import { findOverlapConflict } from './shiftConflicts.js';
import {
  SMLMV,
  DAILY_ORDINARY_LIMIT,
  SEVERANCE_RATE,
  VACATION_RATE,
  OT_DIURNAL,
  OT_NOCTURNAL,
  SUNDAY_HOLIDAY,
} from './constants.js';

/** Base de pruebas: hora directa, contrato laboral, sin descanso ni transporte. */
const base = {
  hourlyRate: 10000,
  monthlySalary: 0,
  contractType: 'indefinido',
  healthRate: 4,
  pensionRate: 4,
  breakMinutes: 0,
  transportMode: 'ninguno',
};

describe('timeToHours (estricto)', () => {
  it('rechaza negativos, horas > 24 y 24:MM con MM > 0', () => {
    expect(timeToHours('-01:00')).toBeNaN();
    expect(timeToHours('25:00')).toBeNaN();
    expect(timeToHours('24:01')).toBeNaN();
    expect(timeToHours('24:60')).toBeNaN();
    expect(timeToHours('12:60')).toBeNaN();
    expect(timeToHours('abc')).toBeNaN();
    expect(timeToHours('')).toBeNaN();
  });

  it('acepta valores válidos', () => {
    expect(timeToHours('00:00')).toBe(0);
    expect(timeToHours('24:00')).toBe(24);
    expect(timeToHours('12:30')).toBe(12.5);
    expect(timeToHours('06:15')).toBe(6.25);
  });
});

describe('constantes legales vigentes 2026 (CST arts. 168 y 179 · Ley 2466 de 2025)', () => {
  it('extras planas: sin escalonado después de la 2.ª hora', () => {
    expect(OT_DIURNAL).toMatchObject({ first: 0.25, rest: 0.25 });
    expect(OT_NOCTURNAL).toMatchObject({ first: 0.75, rest: 0.75 });
  });

  it('recargos dominicales a 90% y multiplicadores acumulados 2,15 / 2,65', () => {
    expect(SUNDAY_HOLIDAY).toMatchObject({ diurnal: 0.9, nocturnal: 1.25, overtimeBase: 0.9 });
    expect(1 + SUNDAY_HOLIDAY.overtimeBase + OT_DIURNAL.first).toBeCloseTo(2.15, 5); // +115%
    expect(1 + SUNDAY_HOLIDAY.overtimeBase + OT_NOCTURNAL.first).toBeCloseTo(2.65, 5); // +165%
  });
});

describe('turno que cruza la medianoche hacia el domingo', () => {
  const shift = { id: 's1', date: '2026-11-14', startTime: '22:00', endTime: '06:00' };

  it('parte el turno en día 1 (sábado) y día 2 (domingo) con flags independientes', () => {
    const d = describeShift(shift);
    expect(d.duration).toBe(8);
    expect(d.segments).toHaveLength(2);
    expect(d.segments[0]).toMatchObject({ date: '2026-11-14', isSunday: false, isHoliday: false });
    expect(d.segments[1]).toMatchObject({ date: '2026-11-15', isSunday: true, isHoliday: false });
  });

  it('cobra el sábado de noche como ordinaria y el domingo de noche con recargo dominical', () => {
    const res = calculateRangePayroll({
      shifts: [shift],
      settings: base,
      from: '2026-11-14',
      to: '2026-11-15',
    });
    expect(res.hours.ordinary).toBe(2); // sábado noche (no domingas)
    expect(res.hours.sundayHoliday).toBe(6); // domingo 00:00–06:00
    expect(res.hours.overtime).toBe(0);
    expect(res.hours.byCategory.ordinaryNocturnal).toBe(2);
    expect(res.earnings.ordinaryNocturnal).toBe(27000); // 2 h × 10.000 × 1,35
    expect(res.earnings.sundayHolidayNocturnal).toBe(135000); // 6 h × 10.000 × 2,25 (90% + 35%)
  });
});

describe('clasificación cronológica ordinaria → extra diurna → extra nocturna', () => {
  it('reparte el lunes 09:00–21:00 según la línea de tiempo', () => {
    const res = calculateRangePayroll({
      shifts: [{ id: 'm1', date: '2026-11-23', startTime: '09:00', endTime: '21:00' }],
      settings: base,
      from: '2026-11-23',
      to: '2026-11-23',
    });
    expect(res.hours.byCategory.ordinaryDiurnal).toBe(8); // 09:00–17:00
    expect(res.hours.byCategory.overtimeDiurnal).toBe(2); // 17:00–19:00 (1.ª franja)
    expect(res.hours.byCategory.overtimeNocturnal).toBe(2); // 19:00–21:00 (2.ª franja)
    expect(res.earnings.ordinaryDiurnal).toBe(80000);
    expect(res.earnings.overtimeDiurnal).toBe(25000); // 2 × 10.000 × 1,25
    expect(res.earnings.overtimeNocturnal).toBe(35000); // 2 × 10.000 × 1,75 (planas, art. 168)
  });
});

describe('domingo que supera el límite diario', () => {
  const shift = { id: 'd1', date: '2026-11-15', startTime: '08:00', endTime: '18:00' };

  it('aplica recargo dominical a las ordinarias y acumulado a las extras', () => {
    const res = calculateRangePayroll({
      shifts: [shift],
      settings: { ...base, dailyOrdinaryLimit: DAILY_ORDINARY_LIMIT },
      from: '2026-11-15',
      to: '2026-11-15',
    });
    expect(res.hours.sundayHoliday).toBe(8);
    expect(res.hours.sundayHolidayOvertime).toBe(2);
    expect(res.earnings.sundayHolidayDiurnal).toBe(152000); // 8 × 10.000 × 1,90 (90% jul-2026)
    // Extras dominicales acumulativas: 1 + 90% dom. + 25% extra = 2,15
    expect(res.earnings.sundayHolidayOvertimeDiurnal).toBe(43000); // 2 × 10.000 × 2,15
  });

  it('usa DAILY_ORDINARY_LIMIT por defecto si no viene configurado', () => {
    const res = calculateRangePayroll({
      shifts: [shift],
      settings: base, // sin dailyOrdinaryLimit
      from: '2026-11-15',
      to: '2026-11-15',
    });
    expect(res.meta.dailyOrdinaryLimit).toBe(DAILY_ORDINARY_LIMIT);
    expect(res.hours.sundayHolidayOvertime).toBe(2);
  });

  it('cobra la extra nocturna dominical con el acumulado ×2,65', () => {
    const res = calculateRangePayroll({
      shifts: [{ id: 'd2', date: '2026-11-22', startTime: '15:00', endTime: '06:00' }],
      settings: base,
      from: '2026-11-22',
      to: '2026-11-23',
    });
    // Domingo 15:00–24:00 = 9 h → 8 ordinarias (4 diurnas + 4 nocturnas) + 1 extra nocturna
    expect(res.hours.sundayHoliday).toBe(8);
    expect(res.hours.sundayHolidayOvertime).toBe(1);
    expect(res.hours.byCategory.sundayHolidayOvertimeNocturnal).toBe(1);
    expect(res.earnings.sundayHolidayOvertimeNocturnal).toBe(26500); // 1 × 10.000 × 2,65
  });
});

describe('auxilio de transporte por salario base (≤ 2 SMLMV)', () => {
  it('se conserva aunque las extras suban el devengado por encima del umbral', () => {
    const dates = [
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-16',
    ];
    const shifts = dates.map((date, i) => ({
      id: `t${i}`,
      date,
      startTime: '04:00',
      endTime: '00:00', // 20 h/día
    }));
    const res = calculateRangePayroll({
      shifts,
      settings: {
        ...base,
        monthlySalary: 2 * SMLMV, // salario base justo en el tope
        hourlyRate: 0,
        transportMode: 'proporcional',
      },
      from: '2026-11-03',
      to: '2026-11-16',
    });
    expect(res.meta.baseSalary).toBe(2 * SMLMV);
    expect(res.totals.gross).toBeGreaterThan(2 * SMLMV); // las extras superan el umbral…
    expect(res.earnings.transportAllowance).toBeGreaterThan(0); // …pero el auxilio sigue
    expect(res.earnings.transportAllowance).toBe(Math.round(((0.1 * SMLMV) / 30) * 10));
  });
});

describe('bases de prestaciones (CST)', () => {
  const shift = { id: 'p1', date: '2026-11-17', startTime: '09:00', endTime: '21:00' };
  const grossExcludingTransport = 140000; // 80.000 ord. + 25.000 extra D + 35.000 extra N

  it('vacaciones solo sobre la base ordinaria; cesantías/prima incluyen el transporte', () => {
    const res = calculateRangePayroll({
      shifts: [shift],
      settings: { ...base, transportMode: 'fijo' },
      from: '2026-11-17',
      to: '2026-11-17',
    });
    expect(res.earnings.transportAllowance).toBe(Math.round(0.1 * SMLMV)); // 142.350

    // Vacaciones: excluye extras y recargos → solo ordinarias diurnas (80.000)
    expect(res.benefits.vacation).toBe(Math.round(80000 * (15 / 360) * 100) / 100);
    expect(res.benefits.vacation).toBeLessThan(
      Math.round((grossExcludingTransport + res.earnings.transportAllowance) * VACATION_RATE * 100) / 100,
    );

    // Cesantías y prima: base = devengados + auxilio de transporte
    const benefitsBase = grossExcludingTransport + res.earnings.transportAllowance;
    const expected = Math.round(benefitsBase * SEVERANCE_RATE * 100) / 100;
    expect(res.benefits.severance).toBe(expected);
    expect(res.benefits.prima).toBe(expected);
    expect(res.benefits.severance).toBeGreaterThan(
      Math.round(grossExcludingTransport * SEVERANCE_RATE * 100) / 100,
    );

    // Intereses de cesantías: 12% anual prorrateado por 1 día del rango (art. 192 CST)
    expect(res.benefits.severanceInterest).toBe(
      Math.round(expected * 0.12 * (1 / 360) * 100) / 100,
    );
    expect(res.meta.rangeDays).toBe(1);
  });
});

describe('turnos pendientes (checkOut null)', () => {
  const pending = { id: 'p1', date: '2026-11-17', startTime: '08:00', endTime: null };
  const closed = { id: 'c1', date: '2026-11-17', startTime: '14:00', endTime: '22:00' };

  it('se excluyen del cálculo: 0 horas, sin NaN y con metadata', () => {
    const res = calculateRangePayroll({
      shifts: [pending],
      settings: base,
      from: '2026-11-17',
      to: '2026-11-17',
    });
    expect(isPendingShift(pending)).toBe(true);
    expect(isPendingShift(closed)).toBe(false);
    expect(res.hours.total).toBe(0);
    expect(res.totals.gross).toBe(0);
    expect(res.totals.net).toBe(0);
    expect(Number.isNaN(res.totals.effectiveHourlyRate)).toBe(false);
    expect(res.meta.shiftCount).toBe(0);
    expect(res.meta.pendingCount).toBe(1);
    expect(res.meta.pendingShifts).toEqual([
      { id: 'p1', date: '2026-11-17', startTime: '08:00' },
    ]);
  });

  it('no altera las horas de un turno cerrado del mismo periodo', () => {
    const res = calculateRangePayroll({
      shifts: [pending, closed],
      settings: base,
      from: '2026-11-17',
      to: '2026-11-17',
    });
    expect(res.hours.total).toBe(8); // solo el turno cerrado
    expect(res.meta.shiftCount).toBe(1);
    expect(res.meta.pendingCount).toBe(1);
  });
});

describe('solape de intervalos con cruce de medianoche', () => {
  const nextDay = { id: 'n1', date: '2026-11-18', startTime: '06:00', endTime: '14:00' };
  const overnight = { id: 'n2', date: '2026-11-17', startTime: '22:00', endTime: '06:00' };

  it('no marca solape si la salida sugerida termina antes del turno siguiente', () => {
    expect(
      findOverlapConflict({
        shifts: [nextDay],
        date: '2026-11-17',
        startTime: '20:00',
        endTime: '05:00', // cierra 1 h antes del turno del día siguiente
      }),
    ).toBeNull();
  });

  it('marca el solape exacto con el turno siguiente (cruce de medianoche)', () => {
    const conflict = findOverlapConflict({
      shifts: [nextDay],
      date: '2026-11-17',
      startTime: '20:00',
      endTime: '07:00', // invade el turno 06:00–14:00 del 18
    });
    expect(conflict?.type).toBe('overlap');
    expect(conflict?.existing.id).toBe('n1');
    expect(conflict?.message).toContain('06:00 a 14:00');
    expect(conflict?.message).toContain('siguiente');
  });

  it('considera turnos vecinos que cruzan medianoche y respeta excludeId', () => {
    // Candidato 14:00–23:00 del 17 choca con el turno 22:00→06:00
    const conflict = findOverlapConflict({
      shifts: [overnight],
      date: '2026-11-17',
      startTime: '14:00',
      endTime: '23:00',
    });
    expect(conflict?.existing.id).toBe('n2');
    // El propio turno en edición nunca se auto-colisiona
    expect(
      findOverlapConflict({
        shifts: [overnight],
        date: '2026-11-17',
        startTime: '22:00',
        endTime: '06:00',
        excludeId: 'n2',
      }),
    ).toBeNull();
  });
});

describe('cierre automático con la jornada diaria', () => {
  it('calcula la salida candidata con vuelta de medianoche', () => {
    expect(addHoursToTime('20:00', 9)).toBe('05:00');
    expect(addHoursToTime('08:00', 8)).toBe('16:00');
    expect(addHoursToTime('16:00', 8)).toBe('00:00');
    expect(addHoursToTime('08:00', 0)).toBeNull();
    expect(addHoursToTime('mal', 8)).toBeNull();
  });

  it('usa jornada diaria + descanso como duración bruta (neto = límite legal)', () => {
    expect(dailySpanHours({ dailyOrdinaryLimit: 8, breakMinutes: 60 })).toBe(9);
    expect(dailySpanHours({ dailyOrdinaryLimit: 7, breakMinutes: 0 })).toBe(7);
    expect(dailySpanHours(null)).toBe(DAILY_ORDINARY_LIMIT);
  });

  it('caso limpio: cierra sin solape · caso con solape: conflicto con el turno siguiente', () => {
    const p = { id: 'p1', date: '2026-11-17', startTime: '20:00', endTime: null };
    const nextShift = { id: 'n1', date: '2026-11-18', startTime: '06:00', endTime: '14:00' };
    const settings = { dailyOrdinaryLimit: 8, breakMinutes: 60 };
    const checkOut = addHoursToTime(p.startTime, dailySpanHours(settings));
    expect(checkOut).toBe('05:00');

    expect(
      findOverlapConflict({
        shifts: [p, nextShift],
        date: p.date,
        startTime: p.startTime,
        endTime: checkOut,
        excludeId: p.id,
      }),
    ).toBeNull(); // 05:00 ≤ 06:00 del día siguiente

    // Si el turno siguiente empezara más temprano, no se guarda
    const early = { id: 'n2', date: '2026-11-18', startTime: '04:00', endTime: '12:00' };
    const conflict = findOverlapConflict({
      shifts: [p, early],
      date: p.date,
      startTime: p.startTime,
      endTime: checkOut,
      excludeId: p.id,
    });
    expect(conflict?.type).toBe('overlap');
    expect(conflict?.existing.id).toBe('n2');
  });
});

