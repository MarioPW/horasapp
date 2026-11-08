import { useEffect, useRef, useState } from 'preact/hooks';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { listShiftsInRange } from '../services/shifts.js';
import { calculateRangePayroll, computeShiftDuration, resolveHourlyRate, totalHours } from '../utils/payrollCalculator.js';
import { todayISO, startOfMonthISO, isSunday } from '../utils/dates.js';
import { isColombianHoliday } from '../utils/holidays.js';
import { formatDateShort, formatDayAbbr, formatDayName, formatHours } from '../utils/format.js';
import PayrollSummary from './PayrollSummary.jsx';

/** Vista dedicada de cálculo de nómina (ruta #/nomina).
 *  Estado inicial: corte + lista de turnos del rango.
 *  Al calcular: la lista se colapsa y entra el resumen; volver = cambiar fechas o "Ver turnos". */
export default function PayrollCalc({ onOpenSettings }) {
  const { configured } = useAuth();
  const { settings } = useSettings();
  const [range, setRange] = useState({ from: startOfMonthISO(), to: todayISO() });
  const [shifts, setShifts] = useState([]);
  const [loadingShifts, setLoadingShifts] = useState(configured);
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const contentRef = useRef(null);

  const scrollToContent = () =>
    setTimeout(() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);

  // Cambiar fechas → recarga la lista y vuelve a la vista inicial (sin resumen)
  useEffect(() => {
    setResult(null);
    if (!configured) {
      setShifts([]);
      setLoadingShifts(false);
      return undefined;
    }
    let alive = true;
    setLoadingShifts(true);
    listShiftsInRange(range.from, range.to)
      .then((data) => alive && setShifts(data))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoadingShifts(false));
    return () => {
      alive = false;
    };
  }, [configured, range.from, range.to]);

  const setRangeField = (key) => (e) => {
    setResult(null); // cambiar fechas → volver a la lista
    setRange((r) => ({ ...r, [key]: e.currentTarget.value }));
  };

  const resetMonth = () => {
    setResult(null);
    setRange({ from: startOfMonthISO(), to: todayISO() });
  };

  const handleCalculate = async () => {
    setError('');
    if (!range.from || !range.to) return setError('Selecciona ambas fechas del corte.');
    if (range.from > range.to) return setError('La fecha inicial debe ser anterior a la final.');
    if (resolveHourlyRate(settings) <= 0) {
      onOpenSettings();
      return setError('Define tu valor de hora o salario mensual en Datos laborales para calcular.');
    }

    setCalculating(true);
    try {
      const inRange = await listShiftsInRange(range.from, range.to);
      setShifts(inRange);
      setResult(calculateRangePayroll({ shifts: inRange, settings, from: range.from, to: range.to }));
      scrollToContent();
    } catch (e) {
      setError(e.message);
    } finally {
      setCalculating(false);
    }
  };

  return (
    <>
      <header className="mb-4 rise">
        <p className="text-indigo text-uppercase fw-semibold small mb-1 lh-1">Nómina</p>
        <h1 className="h3 fw-bold mb-1">Cálculo de nómina</h1>
        <p className="text-secondary mb-0">
          Revisa los turnos del periodo y calcula con un solo botón.
        </p>
      </header>

      <div className="row g-4">
        <div className="col-12 col-lg-4">
          <section className="card ha-card rise">
            <div className="card-body p-3 p-sm-4">
              <h2 className="h6 fw-bold text-uppercase text-secondary mb-3">
                <i className="bi bi-calendar-range me-2 text-indigo" />
                Corte de nómina
              </h2>
              <div className="row g-3">
                <div className="col-12 col-sm-6 col-lg-12">
                  <label className="form-label small fw-semibold" htmlFor="cut-from">
                    Desde
                  </label>
                  <input
                    id="cut-from"
                    type="date"
                    className="form-control"
                    value={range.from}
                    onInput={setRangeField('from')}
                  />
                </div>
                <div className="col-12 col-sm-6 col-lg-12">
                  <label className="form-label small fw-semibold" htmlFor="cut-to">
                    Hasta
                  </label>
                  <input
                    id="cut-to"
                    type="date"
                    className="form-control"
                    value={range.to}
                    onInput={setRangeField('to')}
                  />
                </div>
              </div>

              <div className="d-flex flex-column flex-sm-row gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-brand rounded-pill px-4 py-2 fw-semibold flex-grow-1"
                  onClick={handleCalculate}
                  disabled={calculating || !configured}
                >
                  {calculating ? (
                    <span className="spinner-border spinner-border-sm me-2" />
                  ) : (
                    <i className="bi bi-calculator me-2" />
                  )}
                  Calcular Nómina
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-pill px-4 py-2"
                  onClick={resetMonth}
                >
                  Este mes
                </button>
              </div>

              {result && (
                <button
                  type="button"
                  className="btn btn-outline-indigo rounded-pill px-4 py-2 w-100 mt-2"
                  onClick={() => {
                    setResult(null);
                    scrollToContent();
                  }}
                >
                  <i className="bi bi-list-check me-2" />
                  Ver turnos del periodo
                </button>
              )}

              {!configured && (
                <p className="form-text small mt-3 mb-0">
                  <i className="bi bi-info-circle me-1" />
                  Modo demo: conecta Firebase para calcular con tus turnos reales.
                </p>
              )}

              {error && (
                <div className="alert alert-danger py-2 small mt-3 mb-0" role="alert">
                  <i className="bi bi-exclamation-circle me-1" />
                  {error}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="col-12 col-lg-8" ref={contentRef}>
          {result ? (
            <PayrollSummary result={result} />
          ) : (
            <section className="card ha-card rise">
              <div className="card-body p-3 p-sm-4">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                  <h2 className="h6 fw-bold text-uppercase text-secondary mb-0">
                    <i className="bi bi-list-check me-2 text-indigo" />
                    Turnos del periodo
                  </h2>
                  {!loadingShifts && shifts.length > 0 && (
                    <span className="badge text-bg-light border text-nowrap">
                      {shifts.length} · {formatHours(totalHours(shifts))}
                    </span>
                  )}
                </div>

                {loadingShifts ? (
                  <div className="d-grid gap-2">
                    <div className="ha-skeleton" />
                    <div className="ha-skeleton" />
                    <div className="ha-skeleton" />
                  </div>
                ) : shifts.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="bi bi-calendar2-x fs-1 text-secondary opacity-50" />
                    <p className="text-secondary small mt-2 mb-0">
                      {configured
                        ? `Sin turnos entre ${range.from} y ${range.to}. Ajusta el corte o registra turnos.`
                        : 'Modo demo: conecta Firebase para ver tus turnos.'}
                    </p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0 ha-shift-table">
                      <thead>
                        <tr>
                          <th className="ha-col-date">Fecha</th>
                          <th className="ha-col-time">Horario</th>
                          <th className="ha-col-hours text-end">Horas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shifts.map((s) => {
                          const sunday = isSunday(s.date);
                          const holiday = isColombianHoliday(s.date);
                          return (
                            <tr key={s.id}>
                              <td
                                className="ha-col-date"
                                title={`${formatDayName(s.date)}${holiday ? ' (festivo)' : ''}`}
                              >
                                <span className="fw-semibold">
                                  {formatDateShort(s.date)}
                                  <span className="d-none d-sm-inline"> {s.date.slice(0, 4)}</span>
                                </span>
                                <span
                                  className={`ha-day ${
                                    sunday ? 'fw-semibold text-warning-emphasis' : 'text-secondary'
                                  }`}
                                >
                                  {' · '}
                                  <span className="d-lg-none">{formatDayAbbr(s.date)}</span>
                                  <span className="d-none d-lg-inline">{formatDayName(s.date)}</span>
                                </span>
                                {holiday && !sunday && (
                                  <span className="badge text-bg-info ms-1 d-none d-sm-inline">
                                    Fest.
                                  </span>
                                )}
                              </td>
                              <td className="ha-col-time tabular">
                                {s.startTime} <span className="text-indigo">→</span> {s.endTime}
                              </td>
                              <td className="ha-col-hours text-end fw-semibold tabular">
                                {formatHours(computeShiftDuration(s))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
