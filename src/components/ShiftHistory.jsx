import { useEffect, useRef, useState } from 'preact/hooks';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { deleteShift, listShifts, listShiftsInRange, updateShift } from '../services/shifts.js';
import { calculateRangePayroll, computeShiftDuration, totalHours } from '../utils/payrollCalculator.js';
import { todayISO, startOfMonthISO, isSunday } from '../utils/dates.js';
import { isColombianHoliday } from '../utils/holidays.js';
import { formatDateShort, formatDayAbbr, formatDayName, formatHours } from '../utils/format.js';
import PayrollSummary from './PayrollSummary.jsx';
import ShiftEditModal from './ShiftEditModal.jsx';

export default function ShiftHistory({ onOpenSettings }) {
  const { configured } = useAuth();
  const { settings } = useSettings();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState('');
  const [range, setRange] = useState({ from: startOfMonthISO(), to: todayISO() });
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const resultRef = useRef(null);

  useEffect(() => {
    if (!configured) {
      setShifts([]);
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    listShifts()
      .then((data) => alive && (setShifts(data), setError('')))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [configured]);

  const setRangeField = (key) => (e) => setRange((r) => ({ ...r, [key]: e.currentTarget.value }));

  /** Recalcula con la lista local (tras editar/eliminar) manteniendo el resultado actualizado. */
  const recalc = (list) => {
    if (!result) return;
    setResult(
      calculateRangePayroll({
        shifts: list.filter((s) => s.date >= range.from && s.date <= range.to),
        settings,
        from: range.from,
        to: range.to,
      }),
    );
  };

  const handleCalculate = async () => {
    setError('');
    if (!range.from || !range.to) return setError('Selecciona ambas fechas del corte.');
    if (range.from > range.to) return setError('La fecha inicial debe ser anterior a la final.');
    if (!(settings.hourlyRate > 0)) {
      onOpenSettings();
      return setError('Define tu valor de hora en Ajustes para calcular.');
    }

    setCalculating(true);
    try {
      const inRange = await listShiftsInRange(range.from, range.to);
      setResult(calculateRangePayroll({ shifts: inRange, settings, from: range.from, to: range.to }));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) {
      setError(e.message);
    } finally {
      setCalculating(false);
    }
  };

  const handleSaveEdit = async (data) => {
    await updateShift(editing.id, data);
    const next = shifts.map((s) => (s.id === editing.id ? { ...s, ...data } : s));
    setShifts(next);
    setEditing(null);
    recalc(next);
  };

  const handleDelete = async (id) => {
    setError('');
    try {
      await deleteShift(id);
      const next = shifts.filter((s) => s.id !== id);
      setShifts(next);
      setPendingDelete(null);
      recalc(next);
    } catch (e) {
      setError(e.message);
      setPendingDelete(null);
    }
  };

  const inMonth = shifts.filter((s) => s.date >= range.from && s.date <= range.to);

  return (
    <>
      <header className="mb-4 rise">
        <p className="text-indigo text-uppercase fw-semibold small mb-1 lh-1">Historial</p>
        <h1 className="h3 fw-bold mb-1">Turnos y cálculo de nómina</h1>
        <p className="text-secondary mb-0">
          Selecciona el periodo de corte y calcula con un solo botón.
        </p>
      </header>

      <section className="card ha-card rise mb-4">
        <div className="card-body p-3 p-sm-4">
          <h2 className="h6 fw-bold text-uppercase text-secondary mb-3">
            <i className="bi bi-calendar-range me-2 text-indigo" />
            Corte de nómina
          </h2>
          <div className="row g-3 align-items-end">
            <div className="col-12 col-sm-6 col-lg-3">
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
            <div className="col-12 col-sm-6 col-lg-3">
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
            <div className="col-12 col-lg-6 d-flex flex-column flex-sm-row gap-2">
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
                onClick={() => setRange({ from: startOfMonthISO(), to: todayISO() })}
              >
                Este mes
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger py-2 small mt-3 mb-0" role="alert">
              <i className="bi bi-exclamation-circle me-1" />
              {error}
            </div>
          )}
        </div>
      </section>

      <div className="row g-4">
        <div className="col-12 col-lg-7 order-2 order-lg-1">
          <section className="card ha-card rise">
            <div className="card-body p-3 p-sm-4">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <h2 className="h6 fw-bold text-uppercase text-secondary mb-0">
                  <i className="bi bi-clock-history me-2 text-indigo" />
                  Turnos registrados
                </h2>
                <span className="badge text-bg-light border">
                  {shifts.length} en total · {formatHours(totalHours(inMonth))} en el corte
                </span>
              </div>

              {loading ? (
                <div className="d-grid gap-2">
                  <div className="ha-skeleton" />
                  <div className="ha-skeleton" />
                  <div className="ha-skeleton" />
                </div>
              ) : shifts.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-calendar2-x fs-1 text-secondary opacity-50" />
                  <p className="text-secondary small mt-2 mb-3">
                    {configured ? 'Aún no has registrado turnos.' : 'Modo demo: conecta Firebase para registrar turnos.'}
                  </p>
                  <a href="#/" className="btn btn-brand btn-sm rounded-pill px-4">
                    <i className="bi bi-plus-lg me-1" />
                    Registrar turno
                  </a>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0 ha-shift-table">
                    <thead>
                      <tr>
                        <th className="ha-col-date">Fecha</th>
                        <th className="ha-col-time">Horario</th>
                        <th className="ha-col-hours text-end">Horas</th>
                        <th className="ha-col-actions text-end">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shifts.map((s) => {
                        const hours = computeShiftDuration(s);
                        const sunday = isSunday(s.date);
                        const holiday = isColombianHoliday(s.date);
                        return (
                          <tr key={s.id} className={pendingDelete === s.id ? 'table-danger' : ''}>
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
                              {formatHours(hours)}
                            </td>
                            <td className="ha-col-actions text-end text-nowrap">
                              {pendingDelete === s.id ? (
                                <>
                                  <span className="d-none d-sm-inline small text-secondary me-1">
                                    ¿Eliminar?
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-danger ha-icon-btn me-1"
                                    aria-label="Confirmar eliminación"
                                    onClick={() => handleDelete(s.id)}
                                  >
                                    <i className="bi bi-check-lg" />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary ha-icon-btn"
                                    aria-label="Cancelar eliminación"
                                    onClick={() => setPendingDelete(null)}
                                  >
                                    <i className="bi bi-x-lg" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary ha-icon-btn me-1"
                                    aria-label="Editar turno"
                                    onClick={() => setEditing(s)}
                                  >
                                    <i className="bi bi-pencil" />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger ha-icon-btn"
                                    aria-label="Eliminar turno"
                                    onClick={() => setPendingDelete(s.id)}
                                  >
                                    <i className="bi bi-trash3" />
                                  </button>
                                </>
                              )}
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
        </div>

        <div className="col-12 col-lg-5 order-1 order-lg-2" ref={resultRef}>
          {result ? (
            <PayrollSummary result={result} />
          ) : (
            <section className="card ha-card rise">
              <div className="card-body p-4 text-center py-5">
                <span className="brand-mark d-inline-flex align-items-center justify-content-center mb-3">
                  <i className="bi bi-calculator" />
                </span>
                <h2 className="h6 fw-bold mb-1">Nómina del periodo</h2>
                <p className="small text-secondary mb-0">
                  Define el corte y pulsa <strong>Calcular Nómina</strong> para ver devengos,
                  deducciones y prestaciones.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>

      <ShiftEditModal shift={editing} onClose={() => setEditing(null)} onSave={handleSaveEdit} />
    </>
  );
}
