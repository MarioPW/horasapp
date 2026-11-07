import { useEffect, useState } from 'preact/hooks';
import Modal from './Modal.jsx';
import { todayISO } from '../utils/dates.js';

export default function ShiftEditModal({ shift, onClose, onSave }) {
  const [form, setForm] = useState({ date: '', startTime: '', endTime: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (shift) {
      setForm({ date: shift.date ?? '', startTime: shift.startTime ?? '', endTime: shift.endTime ?? '' });
      setError('');
    }
  }, [shift]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.currentTarget.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.date || !form.startTime || !form.endTime) {
      return setError('Completa fecha, entrada y salida.');
    }
    if (form.startTime === form.endTime) return setError('Las horas deben ser distintas.');

    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal show={Boolean(shift)} onClose={onClose} title="Editar turno">
      {error && (
        <div className="alert alert-danger py-2 small" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <div className="mb-3">
          <label className="form-label small fw-semibold" htmlFor="edit-date">
            Fecha
          </label>
          <input
            id="edit-date"
            type="date"
            className="form-control"
            max={todayISO()}
            value={form.date}
            onInput={set('date')}
          />
        </div>
        <div className="row g-3 mb-3">
          <div className="col-6">
            <label className="form-label small fw-semibold" htmlFor="edit-in">
              Entrada
            </label>
            <input
              id="edit-in"
              type="time"
              className="form-control"
              value={form.startTime}
              onInput={set('startTime')}
            />
          </div>
          <div className="col-6">
            <label className="form-label small fw-semibold" htmlFor="edit-out">
              Salida
            </label>
            <input
              id="edit-out"
              type="time"
              className="form-control"
              value={form.endTime}
              onInput={set('endTime')}
            />
          </div>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary rounded-pill px-4 flex-grow-1" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-brand rounded-pill px-4 flex-grow-1" disabled={saving}>
            {saving ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-check2 me-1" />}
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
