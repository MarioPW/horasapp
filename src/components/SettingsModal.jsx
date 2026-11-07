import { useEffect, useRef, useState } from 'preact/hooks';
import Modal from './Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { CONTRACT_TYPES, getContract } from '../utils/constants.js';

const empty = (s) => ({
  hourlyRate: String(s.hourlyRate ?? ''),
  healthRate: String(s.healthRate ?? ''),
  pensionRate: String(s.pensionRate ?? ''),
  contractType: s.contractType ?? 'horas',
});

export default function SettingsModal({ show, onClose }) {
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

  const submit = async (e) => {
    e.preventDefault();
    const hourlyRate = Number(form.hourlyRate);
    const healthRate = Number(form.healthRate);
    const pensionRate = Number(form.pensionRate);

    if (!(hourlyRate > 0)) return setError('El valor de la hora debe ser mayor a 0.');
    if (!(healthRate >= 0 && healthRate <= 100) || !(pensionRate >= 0 && pensionRate <= 100)) {
      return setError('Los porcentajes deben estar entre 0 y 100.');
    }

    setSaving(true);
    setError('');
    try {
      await save({
        hourlyRate: Math.round(hourlyRate),
        healthRate,
        pensionRate,
        contractType: form.contractType,
      });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const contract = getContract(form.contractType);

  return (
    <Modal show={show} onClose={onClose} title="Ajustes de cuenta">
      <p className="small text-secondary mb-4">
        Configura tu base una vez: se usará en cada cálculo de nómina.
      </p>

      {!configured && (
        <div className="alert alert-warning py-2 small" role="alert">
          Firebase sin configurado: no podrás guardar cambios.
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
          Configuración guardada.
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <div className="mb-3">
          <label className="form-label small fw-semibold" htmlFor="set-rate">
            Valor base de la hora
          </label>
          <div className="input-group">
            <span className="input-group-text">$</span>
            <input
              id="set-rate"
              type="text"
              inputMode="decimal"
              className="form-control"
              value={form.hourlyRate}
              onInput={set('hourlyRate')}
            />
            <span className="input-group-text">/hora</span>
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

        <div className="d-flex gap-2 mt-4">
          <button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="submit"
            className="btn btn-brand rounded-pill px-4 flex-grow-1"
            disabled={saving || loading || !configured}
          >
            {saving ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-save me-1" />}
            Guardar configuración
          </button>
        </div>
      </form>
    </Modal>
  );
}
