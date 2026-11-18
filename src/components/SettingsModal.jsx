import { useEffect, useRef, useState } from 'preact/hooks';
import Modal from './Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { CONTRACT_TYPES, getContract, TRANSPORT_MODES, getTransportMode, HOURS_PER_MONTH, DAILY_ORDINARY_LIMIT } from '../utils/constants.js';

const empty = (s) => {
  const v = s ?? {};
  return {
    hourlyRate: String(v.hourlyRate ?? ''),
    monthlySalary: v.monthlySalary > 0 ? String(v.monthlySalary) : '',
    // Un solo campo: se escoje el modo con el dropdown (uno u otro, nunca ambos)
    payMode: v.monthlySalary > 0 ? 'monthly' : 'hourly',
    healthRate: String(v.healthRate ?? ''),
    pensionRate: String(v.pensionRate ?? ''),
    contractType: v.contractType ?? CONTRACT_TYPES[0].value, // preselección del dropdown
    breakMinutes: String(v.breakMinutes ?? ''),
    dailyOrdinaryLimit:
      v.dailyOrdinaryLimit > 0 ? String(v.dailyOrdinaryLimit) : '',
    transportMode: v.transportMode ?? TRANSPORT_MODES[0].value,
  };
};

export default function SettingsModal({ show, onClose, locked = false }) {
  const { configured } = useAuth();
  const { settings, save, loading } = useSettings();
  const [form, setForm] = useState(() => empty(settings));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const wasOpen = useRef(false);

  // Sincroniza solo al abrir: conserva el mensaje de éxito tras guardar
  useEffect(() => {
    if (show && !wasOpen.current) {
      setForm(empty(settings));
      setError('');
      setSaved(false);
    }
    wasOpen.current = show;
  }, [show, settings]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.currentTarget.value }));

  const onContract = (e) => {
    const value = e.currentTarget.value;
    const contract = getContract(value);
    setForm((f) => ({
      ...f,
      contractType: value,
      healthRate: String(contract.healthRate),
      pensionRate: String(contract.pensionRate),
    }));
  };

  // Dropdown + input único: escribe en el modo activo y conserva el otro valor
  const setPayMode = (e) => setForm((f) => ({ ...f, payMode: e.currentTarget.value }));

  const onPayInput = (e) => {
    const raw = e.currentTarget.value;
    setForm((f) => (f.payMode === 'monthly' ? { ...f, monthlySalary: raw } : { ...f, hourlyRate: raw }));
  };

  const submit = async (e) => {
    e.preventDefault();
    // Un solo ingreso: el modo activo (dropdown) define si es salario mensual u hora directa
    const isMonthly = form.payMode === 'monthly';
    const raw = String(isMonthly ? form.monthlySalary : form.hourlyRate).trim();
    const value = raw === '' ? 0 : Number(raw);
    const monthlySalary = isMonthly ? Math.round(value) : 0;
    const hourlyRate = isMonthly ? Math.round(value / HOURS_PER_MONTH) : Math.round(value);
    const healthRate = Number(form.healthRate);
    const pensionRate = Number(form.pensionRate);
    const breakRaw = String(form.breakMinutes ?? '').trim();
    const breakMinutes = breakRaw === '' ? 0 : Number(breakRaw);
    const limitRaw = String(form.dailyOrdinaryLimit ?? '').trim();
    const dailyOrdinaryLimit = limitRaw === '' ? 0 : Number(limitRaw);

    if (!(value > 0)) {
      return setError(
        isMonthly
          ? 'El salario mensual debe ser mayor a 0.'
          : 'El valor de la hora debe ser mayor a 0.',
      );
    }
    if (!(healthRate >= 0 && healthRate <= 100) || !(pensionRate >= 0 && pensionRate <= 100)) {
      return setError('Los porcentajes deben estar entre 0 y 100.');
    }
    if (!Number.isFinite(breakMinutes) || breakMinutes < 0 || breakMinutes > 600) {
      return setError('Los minutos de descanso deben estar entre 0 y 600.');
    }
    if (
      limitRaw !== '' &&
      (!Number.isFinite(dailyOrdinaryLimit) || dailyOrdinaryLimit < 1 || dailyOrdinaryLimit > 12)
    ) {
      return setError('El límite de horas ordinarias al día debe estar entre 1 y 12.');
    }

    setSaving(true);
    setError('');
    try {
      await save({
        hourlyRate,
        monthlySalary,
        healthRate,
        pensionRate,
        contractType: form.contractType,
        breakMinutes: Math.round(breakMinutes),
        dailyOrdinaryLimit:
          limitRaw === '' ? DAILY_ORDINARY_LIMIT : Math.round(dailyOrdinaryLimit),
        transportMode: TRANSPORT_MODES.some((m) => m.value === form.transportMode)
          ? form.transportMode
          : 'proporcional',
      });
      setSaved(true);
      if (locked) onClose(); // onboarding: solo se cierra con datos guardados
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const contract = getContract(form.contractType);

  return (
    <Modal
      show={show}
      onClose={onClose}
      dismissible={!locked}
      title={
        <>
          <i className="bi bi-person-badge me-1 text-indigo" />
          Datos laborales
        </>
      }
    >
      {locked ? (
        <div className="alert alert-info py-2 small" role="alert">
          <i className="bi bi-exclamation-circle me-1" />
          Completa y guarda tus datos laborales para usar Horasapp: así podrás registrar tus turnos y calcular tu nómina.
        </div>
      ) : (
        <p className="small text-secondary mb-4">
          Configura tu base una vez: se usará en cada cálculo de nómina.
        </p>
      )}

      {!configured && (
        <div className="alert alert-warning py-2 small" role="alert">
          Modo demo: los datos se guardan solo en esta sesión.
        </div>
      )}
      {error && (
        <div className="alert alert-danger py-2 small" role="alert">
          {error}
        </div>
      )}
      {saved && (
        <div className="alert alert-success py-2 small" role="status">
          <i className="bi bi-check-circle me-1" />
          Datos guardados.
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <div className="mb-3">
          <label className="form-label small fw-semibold" htmlFor="set-pay">
            Salario o valor de hora
          </label>
          {/* Input único + dropdown: solo uno de los dos modos a la vez */}
          <div className="input-group">
            <span className="input-group-text p-0">
              <select
                className="form-select ha-mode-select"
                value={form.payMode}
                onChange={setPayMode}
                aria-label="Modo de ingreso"
              >
                <option value="monthly">Salario mensual</option>
                <option value="hourly">Valor hora</option>
              </select>
            </span>
            <span className="input-group-text">$</span>
            <input
              id="set-pay"
              type="text"
              inputMode="numeric"
              className="form-control tabular"
              value={form.payMode === 'monthly' ? form.monthlySalary : form.hourlyRate}
              onInput={onPayInput}
              placeholder="0"
            />
            <span className="input-group-text">
              {form.payMode === 'monthly' ? '/mes' : '/hora'}
            </span>
          </div>
          <div className="form-text small">
            {form.payMode === 'monthly' ? (
              <>
                <i className="bi bi-calculator me-1" />
                El valor de la hora se deriva con el divisor legal (÷ {HOURS_PER_MONTH} h/mes,
                jornada de 42 h/semana).
              </>
            ) : (
              <>
                <i className="bi bi-clock me-1" />
                Valor fijo por hora, sin salario mensual.
              </>
            )}
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-6">
            <label className="form-label small fw-semibold" htmlFor="set-health">
              Salud (%)
            </label>
            <input
              id="set-health"
              type="text"
              inputMode="decimal"
              className="form-control"
              value={form.healthRate}
              onInput={set('healthRate')}
            />
          </div>
          <div className="col-6">
            <label className="form-label small fw-semibold" htmlFor="set-pension">
              Pensión (%)
            </label>
            <input
              id="set-pension"
              type="text"
              inputMode="decimal"
              className="form-control"
              value={form.pensionRate}
              onInput={set('pensionRate')}
            />
          </div>
        </div>

        <div className="mb-2">
          <label className="form-label small fw-semibold" htmlFor="set-contract">
            Tipo de contrato
          </label>
          <select id="set-contract" className="form-select" value={form.contractType} onChange={onContract}>
            {CONTRACT_TYPES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <div className="form-text small">
            {contract.benefits
              ? 'Contrato laboral: aplica auxilio de transporte y prestaciones sociales.'
              : 'Prestación de servicios: cotizaciones auto-liquidadas y sin prestaciones sociales.'}
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label small fw-semibold" htmlFor="set-transport">
            Auxilio de transporte
          </label>
          <select
            id="set-transport"
            className="form-select"
            value={form.transportMode}
            onChange={set('transportMode')}
          >
            {TRANSPORT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <div className="form-text small">
            {getTransportMode(form.transportMode).value === 'proporcional'
              ? 'Se calcula (valor mensual / 30) × días trabajados en el corte.'
              : getTransportMode(form.transportMode).value === 'fijo'
                ? 'Entrega el valor mensual completo sin importar los días del corte.'
                : 'Sin auxilio: para trabajo remoto o ingreso superior a 2 SMLMV.'}
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label small fw-semibold" htmlFor="set-break">
            Minutos de descanso{' '}
            <span className="text-secondary fw-normal">(opcional)</span>
          </label>
          <div className="input-group">
            <input
              id="set-break"
              type="text"
              inputMode="numeric"
              className="form-control"
              value={form.breakMinutes}
              onInput={set('breakMinutes')}
              placeholder="0"
            />
            <span className="input-group-text">min/día</span>
          </div>
          <div className="form-text small">
            Descanso no pagado por jornada: se descuenta primero de las horas diurnas de cada turno.
            Vacío o 0 = sin descuento.
          </div>
        </div>

        <div className="mb-2">
          <label className="form-label small fw-semibold" htmlFor="set-limit">
            Límite de horas ordinarias al día{' '}
            <span className="text-secondary fw-normal">(opcional)</span>
          </label>
          <div className="input-group">
            <input
              id="set-limit"
              type="text"
              inputMode="numeric"
              className="form-control"
              value={form.dailyOrdinaryLimit}
              onInput={set('dailyOrdinaryLimit')}
              placeholder={String(DAILY_ORDINARY_LIMIT)}
            />
            <span className="input-group-text">h/día</span>
          </div>
          <div className="form-text small">
            Horas pagadas como ordinarias antes de empezar a contar extras. Por defecto{' '}
            {DAILY_ORDINARY_LIMIT} h/día (jornada legal de 42 h/semana en 6 días → 7 h/día, Ley 2101
            de 2021; divisor mensual ÷ {HOURS_PER_MONTH} h). Vacío = {DAILY_ORDINARY_LIMIT} h/día.
          </div>
        </div>

        <div className="d-flex gap-2 mt-4">
          {!locked && (
            <button
              type="button"
              className="btn btn-outline-secondary rounded-pill px-4"
              onClick={onClose}
            >
              Cerrar
            </button>
          )}
          <button
            type="submit"
            className="btn btn-brand rounded-pill px-4 flex-grow-1"
            disabled={saving || loading}
          >
            {saving ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-save me-1" />}
            Guardar configuración
          </button>
        </div>
      </form>
    </Modal>
  );
}
