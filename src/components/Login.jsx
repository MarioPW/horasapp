import { useState } from 'preact/hooks';
import { useAuth } from '../context/AuthContext.jsx';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="me-2">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.1 35.2 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C36.9 40.2 44 35 44 24c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
);

export default function Login() {
  const { loginWithEmail, loginWithGoogle, registerWithEmail } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.currentTarget.value }));
  const toggleMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setError('');
  };

  const run = async (key, fn) => {
    setPending(key);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setPending('');
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const { name, email, password } = form;
    if (!email.trim() || !password) return setError('Correo y contraseña son obligatorios.');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    if (mode === 'register' && !name.trim()) return setError('Ingresa tu nombre.');
    run('form', () =>
      mode === 'login'
        ? loginWithEmail(email, password)
        : registerWithEmail(name, email, password),
    );
  };

  return (
    <div className="auth-shell d-flex align-items-center justify-content-center p-3">
      <div className="container">
        <div className="row g-0 auth-card mx-auto">
          <aside className="col-lg-5 d-none d-lg-flex flex-column justify-content-between p-4 p-xl-5 auth-brand">
            <div>
              <span className="brand-mark d-inline-flex align-items-center justify-content-center mb-4">
                <i className="bi bi-clock-history fs-3" />
              </span>
              <h2 className="h4 fw-bold text-white mb-2">Tu nómina, clara y al día</h2>
              <p className="text-white-50 small mb-4">
                Regístrate y calcula en minutos lo que debes ganar por tus horas trabajadas.
              </p>
              <ul className="list-unstyled small text-white-50 d-grid gap-2">
                <li>
                  <i className="bi bi-check-circle-fill text-info me-2" />
                  Recargo nocturno 35% y horas extras progresivas
                </li>
                <li>
                  <i className="bi bi-check-circle-fill text-info me-2" />
                  Salud y pensión desglosadas automáticamente
                </li>
                <li>
                  <i className="bi bi-check-circle-fill text-info me-2" />
                  Cesantías, prima y vacaciones estimadas
                </li>
              </ul>
            </div>
            <p className="small text-white-50 mb-0">
              Hecho para trabajadores por horas en Colombia 🇨🇴
            </p>
          </aside>

          <div className="col-12 col-lg-7 bg-white p-4 p-sm-5">
            <div className="d-lg-none d-flex align-items-center gap-2 mb-4">
              <span className="brand-mark brand-mark-sm d-inline-flex align-items-center justify-content-center">
                <i className="bi bi-clock-history" />
              </span>
              <span className="fw-bold fs-5">Horasapp</span>
            </div>

            <h1 className="h4 fw-bold mb-1">
              {mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}
            </h1>
            <p className="text-secondary small mb-4">
              {mode === 'login'
                ? 'Inicia sesión para guardar tus cálculos.'
                : 'Solo te tomará un minuto.'}
            </p>

            {error && (
              <div className="alert alert-danger py-2 small d-flex align-items-start" role="alert">
                <i className="bi bi-exclamation-circle me-2 mt-1" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={submit} noValidate>
              {mode === 'register' && (
                <div className="mb-3">
                  <label className="form-label small fw-semibold" for="name">
                    Nombre
                  </label>
                  <input
                    id="name"
                    type="text"
                    className="form-control"
                    placeholder="Tu nombre"
                    autocomplete="name"
                    value={form.name}
                    onInput={set('name')}
                  />
                </div>
              )}

              <div className="mb-3">
                <label className="form-label small fw-semibold" for="email">
                  Correo electrónico
                </label>
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="bi bi-envelope" />
                  </span>
                  <input
                    id="email"
                    type="email"
                    className="form-control"
                    placeholder="tu@correo.com"
                    autocomplete="email"
                    value={form.email}
                    onInput={set('email')}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold" for="password">
                  Contraseña
                </label>
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="bi bi-lock" />
                  </span>
                  <input
                    id="password"
                    type="password"
                    className="form-control"
                    placeholder="Mínimo 6 caracteres"
                    autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={form.password}
                    onInput={set('password')}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-brand w-100 py-2 fw-semibold"
                disabled={pending === 'form'}
              >
                {pending === 'form' ? (
                  <span className="spinner-border spinner-border-sm me-2" />
                ) : (
                  <i className={`bi ${mode === 'login' ? 'bi-box-arrow-in-right' : 'bi-person-plus'} me-2`} />
                )}
                {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            </form>

            <div className="d-flex align-items-center gap-3 my-4">
              <hr className="flex-grow-1" />
              <span className="text-secondary small">o continúa con</span>
              <hr className="flex-grow-1" />
            </div>

            <button
              type="button"
              className="btn btn-outline-secondary w-100 py-2 fw-semibold d-flex align-items-center justify-content-center"
              onClick={() => run('google', loginWithGoogle)}
              disabled={pending === 'google'}
            >
              {pending === 'google' ? (
                <span className="spinner-border spinner-border-sm me-2" />
              ) : (
                <GoogleIcon />
              )}
              Google
            </button>

            <p className="text-center small text-secondary mt-4 mb-0">
              {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
              <button type="button" className="btn btn-link p-0 fw-semibold" onClick={toggleMode}>
                {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
