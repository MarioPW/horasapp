import { useState } from 'preact/hooks';
import { useAuth } from '../context/AuthContext.jsx';

const LINKS = [
  { href: '#/', label: 'Dashboard', icon: 'bi-speedometer2', route: '/' },
  { href: '#/historial', label: 'Historial', icon: 'bi-clock-history', route: '/historial' },
];

export default function Navbar({ route, user, guest, onSettings }) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  const goClose = () => setOpen(false);

  return (
    <nav className="navbar navbar-expand-md sticky-top ha-navbar px-3 px-md-4">
      <div className="container-xxl">
        <a className="navbar-brand fw-bold d-flex align-items-center gap-2" href="#/" onClick={goClose}>
          <span className="brand-mark brand-mark-sm d-inline-flex align-items-center justify-content-center">
            <i className="bi bi-clock-history" />
          </span>
          Horasapp
        </a>

        <button
          className="navbar-toggler border-0 shadow-none"
          type="button"
          aria-label="Abrir menú"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <i className={`bi ${open ? 'bi-x-lg' : 'bi-list'} fs-4`} />
        </button>

        <div className={`collapse navbar-collapse ${open ? 'show' : ''}`}>
          <ul className="navbar-nav ms-auto align-items-md-center gap-md-1 mt-3 mt-md-0">
            {LINKS.map((link) => (
              <li className="nav-item" key={link.href}>
                <a
                  className={`nav-link ha-nav-link d-flex align-items-center gap-2 ${
                    route === link.route ? 'active' : ''
                  }`}
                  href={link.href}
                  aria-current={route === link.route ? 'page' : undefined}
                  onClick={goClose}
                >
                  <i className={`bi ${link.icon}`} />
                  {link.label}
                </a>
              </li>
            ))}
            <li className="nav-item">
              <button
                type="button"
                className="nav-link ha-nav-link d-flex align-items-center gap-2 border-0 bg-transparent"
                onClick={() => {
                  goClose();
                  onSettings();
                }}
              >
                <i className="bi bi-gear" />
                Ajustes
              </button>
            </li>
            <li className="nav-item ms-md-2 mt-3 mt-md-0">
              <div className="d-flex align-items-center gap-2">
                <span
                  className={`small text-secondary text-truncate ${guest ? 'd-none' : ''}`}
                  style={{ maxWidth: 190 }}
                  title={guest ? undefined : user.email}
                >
                  <i className="bi bi-person-circle me-1" />
                  {user.displayName || user.email}
                </span>
                {guest ? (
                  <span className="badge text-bg-warning">
                    <i className="bi bi-clipboard-data me-1" />
                    Modo demo
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                    onClick={() => {
                      goClose();
                      logout();
                    }}
                  >
                    <i className="bi bi-box-arrow-right me-1" />
                    Salir
                  </button>
                )}
              </div>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
