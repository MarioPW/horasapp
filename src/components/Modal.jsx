import { useEffect } from 'preact/hooks';

/** Modal controlado por props (sin JS de Bootstrap): backdrop, ESC y scroll lock. */
export default function Modal({ show, onClose, title, size = '', children }) {
  useEffect(() => {
    if (!show) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [show]);

  if (!show) return null;

  return (
    <>
      <div className="modal-backdrop d-block ha-fade" onClick={onClose} />
      <div
        className="modal d-block ha-fade"
        tabIndex={-1}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${size}`}>
          <div className="modal-content ha-modal">
            <div className="modal-header border-0 pb-0">
              <h2 className="modal-title h6 fw-bold mb-0">{title}</h2>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}
