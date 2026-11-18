import { useEffect, useState } from 'preact/hooks';
import { useAuth } from './context/AuthContext.jsx';
import { useSettings } from './context/SettingsContext.jsx';
import { useHashRoute } from './hooks/useHashRoute.js';
import Login from './components/Login.jsx';
import Navbar from './components/Navbar.jsx';
import Dashboard from './components/Dashboard.jsx';
import ShiftHistory from './components/ShiftHistory.jsx';
import PayrollCalc from './components/PayrollCalc.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import PayrollGuide from './components/PayrollGuide.jsx';

const GUEST = { displayName: 'Invitado', email: null };

function Splash({ text = 'Cargando Horasapp…' }) {
  return (
    <div className="splash d-flex flex-column align-items-center justify-content-center gap-3">
      <div className="spinner-border text-indigo" role="status" />
      <span className="small text-white-50">{text}</span>
    </div>
  );
}

function ConfigBanner() {
  return (
    <div className="alert alert-warning rounded-0 mb-0 small text-center border-0 shadow-sm" role="alert">
      <i className="bi bi-triangle-exclamation me-1" />
      Firebase sin configurar: modo demo con cálculo local. Completa{' '}
      <code>src/config/firebaseConfig.js</code> para habilitar login, turnos y guardado.
    </div>
  );
}

/** Fallo al leer los datos laborales: nada se calcula hasta que vuelva a cargar. */
function SettingsError({ message, onRetry }) {
  return (
    <div className="splash d-flex flex-column align-items-center justify-content-center gap-3 px-3">
      <div className="card ha-card" style={{ maxWidth: 420 }}>
        <div className="card-body p-4 text-center">
          <i className="bi bi-cloud-slash fs-1 text-danger" />
          <p className="small text-secondary mt-2 mb-3">
            No pudimos cargar tus datos laborales: {message}
          </p>
          <button type="button" className="btn btn-brand btn-sm rounded-pill px-4" onClick={onRetry}>
            <i className="bi bi-arrow-repeat me-1" />
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Onboarding obligatorio: sin datos laborales no hay acceso al resto de la app. */
function Onboarding({ showSettings }) {
  return (
    <>
      <Splash text="Configura tus datos laborales para continuar…" />
      {showSettings}
    </>
  );
}

export default function App() {
  const { user, loading, configured } = useAuth();
  const { loading: settingsLoading, error: settingsError, reload, needsSetup } = useSettings();
  const route = useHashRoute();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  const openSettings = () => setSettingsOpen(true);
  const openGuide = () => setGuideOpen(true);
  const settingsModal = (
    <SettingsModal
      show={settingsOpen || needsSetup}
      locked={needsSetup}
      onClose={() => setSettingsOpen(false)}
    />
  );

  if (loading) return <Splash />;
  if (configured && !user) return <Login />;
  if (settingsLoading) return <Splash />;
  if (settingsError) return <SettingsError message={settingsError} onRetry={reload} />;
  if (needsSetup) return <Onboarding showSettings={settingsModal} />;

  const session = user ?? GUEST;

  return (
    <div className="app-shell d-flex flex-column min-vh-100">
      <Navbar
        route={route}
        user={session}
        guest={!configured}
        onSettings={openSettings}
        onGuide={openGuide}
      />
      {!configured && <ConfigBanner />}

      <main className="flex-grow-1 py-4 py-md-5 px-3 px-md-4">
        <div className="container-xxl">
          {route === '/historial' && <ShiftHistory />}
          {route === '/nomina' && (
            <PayrollCalc onOpenSettings={openSettings} onOpenGuide={openGuide} />
          )}
          {!['/historial', '/nomina'].includes(route) && (
            <Dashboard onOpenSettings={openSettings} />
          )}
        </div>
      </main>

      <footer className="text-center text-secondary small py-3 px-3">
        Horasapp · Valores estimados con fines informativos, no constituyen liquidación oficial.
      </footer>

      {settingsModal}
      <PayrollGuide show={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
