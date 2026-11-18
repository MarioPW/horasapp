import { useEffect, useState } from 'preact/hooks';
import { useAuth } from '../context/AuthContext.jsx';
import { deleteShift, listShifts, updateShift } from '../services/shifts.js';
import { computeShiftDuration, totalHours } from '../utils/payrollCalculator.js';
import { isSunday } from '../utils/dates.js';
import { isColombianHoliday } from '../utils/holidays.js';
import { formatDateShort, formatDayAbbr, formatDayName, formatHours, formatMonth } from '../utils/format.js';
import ShiftEditModal from './ShiftEditModal.jsx';

/** Vista dedicada de historial (ruta #/historial): solo turnos y su gestión. */
export default function ShiftHistory() {
  const { configured } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(''); // '' = todos los meses
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

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

  const handleSaveEdit = async (data) => {
    await updateShift(editing.id, data);
    setShifts((prev) => prev.map((s) => (s.id === editing.id ? { ...s, ...data } : s)));
    setEditing(null);
  };

  const handleDelete = async (id) => {
    setError('');
    try {
      await deleteShift(id);
      setShifts((prev) => prev.filter((s) => s.id !== id));
      setPendingDelete(null);
    } catch (e) {
      setError(e.message);
      setPendingDelete(null);
    }
  };

  /** Meses con turnos registrados, del más reciente al más antiguo. */
  const months = [...new Set(shifts.map((s) => s.date.slice(0, 7)))].sort().reverse();
  const visible = month ? shifts.filter((s) => s.date.startsWith(month)) : shifts;

  return (
    <>
      <header className="mb-4 rise">
        <p className="text-indigo text-uppercase fw-semibold small mb-1 lh-1">Historial</p>
        <h1 className="h3 fw-bold mb-1">Turnos registrados</h1>
        <p className="text-secondary mb-0">Consulta, edita o elimina tus turnos.</p>
      </header>

      {error && (
        <div className="alert alert-danger py-2 small mb-3" role="alert">
          <i className="bi bi-exclamation-circle me-1" />
          {error}
        </div>
      )}

      <section className="card ha-card rise">
        <div className="card-body p-3 p-sm-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <h2 className="h6 fw-bold text-uppercase text-secondary mb-0">
              <i className="bi bi-clock-history me-2 text-indigo" />
              Turnos
            </h2>
            <div className="d-flex align-items-center gap-2">
              <label className="visually-hidden" htmlFor="filter-month">
                Filtrar por mes
              </label>
              <select
                id="filter-month"
                className="form-select form-select-sm ha-filter"
                value={month}
                onChange={(e) => setMonth(e.currentTarget.value)}
              >
                <option value="">Todos los meses</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatMonth(m)}
                  </option>
                ))}
              </select>
              <span className="badge text-bg-light border text-nowrap">
                {visible.length} · {formatHours(totalHours(visible))}
              </span>
            </div>
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
                {configured
                  ? 'Aún no has registrado turnos.'
                  : 'Modo demo: conecta Firebase para registrar turnos.'}
              </p>
              <a href="#/" className="btn btn-brand btn-sm rounded-pill px-4">
                <i className="bi bi-plus-lg me-1" />
                Registrar turno
              </a>
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-calendar-x fs-1 text-secondary opacity-50" />
              <p className="text-secondary small mt-2 mb-3">Sin turnos en {formatMonth(month)}.</p>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm rounded-pill px-4"
                onClick={() => setMonth('')}
              >
                Ver todos
              </button>
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
                  {visible.map((s) => {
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
                            <span className="badge text-bg-info ms-1 ha-badge-fest">Fest.</span>
                          )}
                        </td>
                        <td className="ha-col-time tabular">
                          {s.startTime} <span className="text-indigo">→</span>{' '}
                          {s.endTime ? (
                            s.endTime
                          ) : (
                            <span className="badge text-bg-warning" title="Sin hora de salida">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="ha-col-hours text-end fw-semibold tabular">
                          {s.endTime ? formatHours(hours) : '—'}
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
                                aria-label={
                                  s.endTime ? 'Editar turno' : 'Registrar salida del turno pendiente'
                                }
                                onClick={() => setEditing(s)}
                              >
                                <i className={`bi ${s.endTime ? 'bi-pencil' : 'bi-door-open'}`} />
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

      <ShiftEditModal shift={editing} onClose={() => setEditing(null)} onSave={handleSaveEdit} />
    </>
  );
}
