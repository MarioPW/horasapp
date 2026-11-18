import { useEffect, useId, useRef } from 'preact/hooks';

/** Modal controlado por props (sin JS de Bootstrap): backdrop, ESC, scroll lock,
 *  foco inicial/restauración y ARIA (role=dialog). `dismissible={false}` bloquea
 *  el cierre (ESC, backdrop y ✕) → onboarding obligatorio. */
export default function Modal({ show, onClose, title, size = '', children, dismissible = true }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const lastFocused = useRef(null);

  useEffect(() => {
    if (!show) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    lastFocused.current = document.activeElement;
    dialogRef.current?.focus({ preventScroll: true });

    const onKey = (e) => e.key === 'Escape' && dismissible && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      lastFocused.current?.focus?.({ preventScroll: true });
    };
  }, [show, dismissible]);

  if (!show) return null;

  const close = dismissible ? onClose : undefined;

  return (
    <>
      <div className="modal-backdrop d-block ha-fade" onClick={close} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="modal d-block ha-fade"
        onClick={(e) => e.target === e.currentTarget && close?.()}
      >
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${size}`}>
          <div className="modal-content ha-modal">
            <div className="modal-header border-0 pb-0">
              <h2 className="modal-title h6 fw-bold mb-0" id={titleId}>
                {title}
              </h2>
              {dismissible && (
                <button type="button" className="btn-close" aria-label="Cerrar" onClick={onClose} />
              )}
            </div>
            <div className="modal-body">{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}
