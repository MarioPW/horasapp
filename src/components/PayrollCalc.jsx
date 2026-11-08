import { useRef, useState } from 'preact/hooks';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { listShiftsInRange } from '../services/shifts.js';
import { calculateRangePayroll } from '../utils/payrollCalculator.js';
import { todayISO, startOfMonthISO } from '../utils/dates.js';
import PayrollSummary from './PayrollSummary.jsx';

/** Vista dedicada de cálculo de nómina (ruta #/nomina). */
export default function PayrollCalc({ onOpenSettings }) {
  const { configured } = useAuth();
  const { settings } = useSettings();
  const [range, setRange] = useState({ from: startOfMonthISO(), to: todayISO() });
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const resultRef = useRef(null);

  const setRangeField = (key) => (e) => setRange((r) => ({ ...r, [key]: e.currentTarget.value }));

  const handleCalculate = async () => {
    setError('');
    if (!range.from || !range.to) return setError('Selecciona ambas fechas del corte.');
    if (range.from > range.to) return setError('La fecha inicial debe ser anterior a la final.');
    if (!(settings.hourlyRate > 0)) {
      onOpenSettings();
      return setError('Define tu valor de hora en Datos laborales para calcular.');
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

  return (
    <>
      <header className="mb-4 rise">
        <p className="text-indigo text-uppercase fw-semibold small mb-1 lh-1">Nómina</p>
        <h1 className="h3 fw-bold mb-1">Cálculo de nómina</h1>
        <p className="text-secondary mb-0">
          Selecciona el periodo de corte y calcula con un solo botón.
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
                  onClick={() => setRange({ from: startOfMonthISO(), to: todayISO() })}
                >
                  Este mes
                </button>
              </div>

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

        <div className="col-12 col-lg-8" ref={resultRef}>
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
    </>
  );
}
