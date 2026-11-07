import { useEffect, useState } from 'preact/hooks';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { saveShift, listShifts } from '../services/shifts.js';
import { computeShiftDuration, totalHours } from '../utils/payrollCalculator.js';
import { todayISO, startOfMonthISO } from '../utils/dates.js';
import { formatCOP, formatHours } from '../utils/format.js';
import { getContract } from '../utils/constants.js';

export default function Dashboard({ onOpenSettings }) {
  const { configured } = useAuth();
  const { settings, loading } = useSettings();
  const [form, setForm] = useState({ date: todayISO(), startTime: '', endTime: '' });
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ count: 0, hours: 0 });

  const month = startOfMonthISO().slice(0, 7);

  const refreshStats = async () => {
    const all = await listShifts();
    const mine = all.filter((s) => s.date.startsWith(month));
    setStats({ count: mine.length, hours: totalHours(mine) });
  };

  useEffect(() => {
    if (configured) refreshStats().catch(() => setStats({ count: 0, hours: 0 }));
  }, [configured]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.currentTarget.value }));

  const submit = async (e) => {
    e.preventDefault();
    setStatus(null);

    if (!form.date || !form.startTime || !form.endTime) {
      return setStatus({ type: 'error', message: 'Completa fecha, entrada y salida.' });
    }
    if (form.startTime === form.endTime) {
      return setStatus({ type: 'error', message: 'La hora de salida debe ser distinta a la de entrada.' });
    }
    const duration = computeShiftDuration(form);
    if (duration <= 0) {
      return setStatus({ type: 'error', message: 'Horario inválido.' });
    }

    setSaving(true);
    try {
      await saveShift(form);
      setStatus({ type: 'ok', message: `Turno registrado: ${formatHours(duration)}.` });
      setForm((f) => ({ ...f, startTime: '', endTime: '' }));
      refreshStats().catch(() => {});
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const contract = getContract(settings.contractType);

  return (
    <>
      <header className="mb-4 rise">
        <p className="text-indigo text-uppercase fw-semibold small mb-1 lh-1">Panel</p>
        <h1 className="h3 fw-bold mb-1">Registra tu turno de hoy</h1>
        <p className="text-secondary mb-0">
          Entrada y salida: calculamos tus horas, recargos y nómina automáticamente.
        </p>
      </header>

      <div className="row g-4">
        <div className="col-12 col-lg-7">
          <section className="card ha-card rise">
            <div className="card-body p-4">
              <h2 className="h6 fw-bold text-uppercase text-secondary mb-3">
                <i className="bi bi-calendar2-check me-2 text-indigo" />
                Check-in / Check-out
              </h2>

              {status && (
                <div
                  className={`alert py-2 small ${
                    status.type === 'ok' ? 'alert-success' : 'alert-danger'
                  }`}
                  role={status.type === 'ok' ? 'status' : 'alert'}
                >
                  <i
                    className={`bi ${
                      status.type === 'ok' ? 'bi-check-circle' : 'bi-exclamation-circle'
                    } me-1`}
                  />
                  {status.message}
                </div>
              )}

              <form onSubmit={submit} noValidate>
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label small fw-semibold" htmlFor="shift-date">
                      Fecha
                    </label>
                    <input
                      id="shift-date"
                      type="date"
                      className="form-control"
                      max={todayISO()}
                      value={form.date}
                      onInput={set('date')}
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-semibold" htmlFor="shift-in">
                      Hora de entrada
                    </label>
                    <input
                      id="shift-in"
                      type="time"
                      className="form-control"
                      value={form.startTime}
                      onInput={set('startTime')}
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-semibold" htmlFor="shift-out">
                      Hora de salida
                    </label>
                    <input
                      id="shift-out"
                      type="time"
                      className="form-control"
                      value={form.endTime}
                      onInput={set('endTime')}
                    />
                    <div className="form-text small mt-1">Si sale después de medianoche, usa la hora del día siguiente.</div>
                  </div>
                </div>

                <div className="d-flex flex-column flex-sm-row gap-2 mt-4">
                  <button
                    type="submit"
                    className="btn btn-brand rounded-pill px-4 py-2 fw-semibold flex-grow-1"
                    disabled={saving || !configured}
                  >
                    {saving ? (
                      <span className="spinner-border spinner-border-sm me-2" />
                    ) : (
                      <i className="bi bi-stopwatch me-2" />
                    )}
                    Registrar turno
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary rounded-pill px-4 py-2"
                    onClick={() => setForm({ date: todayISO(), startTime: '', endTime: '' })}
                  >
                    Limpiar
                  </button>
                </div>
              </form>

              {!configured && (
                <p className="form-text small mt-3 mb-0">
                  El modo demo no almacena turnos: configura Firebase para registrar.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="col-12 col-lg-5">
          <div className="d-flex flex-column gap-3">
            <div className="row g-3 rise">
              <div className="col-6">
                <div className="card ha-stat ha-stat-primary">
                  <div className="card-body p-3">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <span className="small fw-semibold opacity-75">Turnos del mes</span>
                      <i className="bi bi-list-check" />
                    </div>
                    <div className="h5 fw-bold mb-0 tabular">{stats.count}</div>
                  </div>
                </div>
              </div>
              <div className="col-6">
                <div className="card ha-stat ha-stat-success">
                  <div className="card-body p-3">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <span className="small fw-semibold opacity-75">Horas del mes</span>
                      <i className="bi bi-hourglass-split" />
                    </div>
                    <div className="h5 fw-bold mb-0 tabular">{formatHours(stats.hours)}</div>
                  </div>
                </div>
              </div>
            </div>

            <section className="card ha-card rise">
              <div className="card-body p-4">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h2 className="h6 fw-bold text-uppercase text-secondary mb-0">Tu configuración</h2>
                  <button type="button" className="btn btn-sm btn-outline-indigo rounded-pill px-3" onClick={onOpenSettings}>
                    <i className="bi bi-pencil me-1" />
                    Editar
                  </button>
                </div>

                {loading ? (
                  <div className="ha-skeleton" style={{ height: 96 }} />
                ) : (
                  <dl className="row mb-0 small">
                    <dt className="col-6 text-secondary fw-normal">Valor hora</dt>
                    <dd className="col-6 text-end fw-semibold tabular mb-2">
                      {formatCOP(settings.hourlyRate)}
                    </dd>
                    <dt className="col-6 text-secondary fw-normal">Salud / Pensión</dt>
                    <dd className="col-6 text-end fw-semibold mb-2">
                      {settings.healthRate}% / {settings.pensionRate}%
                    </dd>
                    <dt className="col-6 text-secondary fw-normal">Contrato</dt>
                    <dd className="col-6 text-end fw-semibold mb-0">{contract.label}</dd>
                  </dl>
                )}
              </div>
            </section>

            <div className="card ha-card rise">
              <div className="card-body p-4 d-flex gap-3 align-items-start">
                <i className="bi bi-lightbulb fs-4 text-indigo" />
                <p className="small text-secondary mb-0">
                  Después de registrar tus turnos, ve a <strong>Historial</strong> y pulsa{' '}
                  <strong>Calcular Nómina</strong> para ver el desglose de un periodo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
