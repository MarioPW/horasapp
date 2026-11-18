import { useEffect, useState } from 'preact/hooks';
import Modal from './Modal.jsx';
import { todayISO, addDaysISO } from '../utils/dates.js';
import { listShiftsInRange } from '../services/shifts.js';
import { findOverlapConflict } from '../utils/shiftConflicts.js';

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
    if (!form.date || !form.startTime) return setError('Completa la fecha y la hora de entrada.');
    // Sin salida → sigue "Pendiente"; con salida se valida el solape
    const closing = Boolean(form.endTime);
    if (closing && form.startTime === form.endTime) return setError('Las horas deben ser distintas.');

    setSaving(true);
    setError('');
    try {
      if (closing) {
        // Vecinos ±1 día: la salida puede cruzar medianoche hacia un turno posterior
        const nearby = await listShiftsInRange(addDaysISO(form.date, -1), addDaysISO(form.date, 1));
        const conflict = findOverlapConflict({
          shifts: nearby,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          excludeId: shift?.id,
        });
        if (conflict) {
          setError(conflict.message);
          setSaving(false);
          return;
        }
      }
      await onSave({ ...form, endTime: closing ? form.endTime : null });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const pending = shift && !shift.endTime;

  return (
    <Modal show={Boolean(shift)} onClose={onClose} title={pending ? 'Registrar salida' : 'Editar turno'}>
      {error && (
        <div className="alert alert-danger py-2 small" role="alert">
          <i className="bi bi-exclamation-circle me-1" />
          {error}
        </div>
      )}
      {pending && !error && (
        <div className="alert alert-warning py-2 small" role="status">
          <i className="bi bi-clock-history me-1" />
          Turno pendiente: registra la hora de salida para cerrarlo.
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
            <div className="form-text small mt-1">
              Vacío = sigue como pendiente. Si sale después de medianoche, usa la hora del día
              siguiente.
            </div>
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
