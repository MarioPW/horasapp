import { useEffect, useState } from 'preact/hooks';
import { useAuth } from './context/AuthContext.jsx';
import { useHashRoute } from './hooks/useHashRoute.js';
import Login from './components/Login.jsx';
import Navbar from './components/Navbar.jsx';
import Dashboard from './components/Dashboard.jsx';
import ShiftHistory from './components/ShiftHistory.jsx';
import SettingsModal from './components/SettingsModal.jsx';

const GUEST = { displayName: 'Invitado', email: null };

function Splash() {
  return (
    <div className="splash d-flex flex-column align-items-center justify-content-center gap-3">
      <div className="spinner-border text-indigo" role="status" />
      <span className="small text-white-50">Cargando Horasapp…</span>
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

export default function App() {
  const { user, loading, configured } = useAuth();
  const route = useHashRoute();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  if (loading) return <Splash />;
  if (configured && !user) return <Login />;

  const session = user ?? GUEST;
  const openSettings = () => setSettingsOpen(true);

  return (
    <div className="app-shell d-flex flex-column min-vh-100">
      <Navbar route={route} user={session} guest={!configured} onSettings={openSettings} />
      {!configured && <ConfigBanner />}

      <main className="flex-grow-1 py-4 py-md-5 px-3 px-md-4">
        <div className="container-xxl">
          {route === '/historial' ? (
            <ShiftHistory onOpenSettings={openSettings} />
          ) : (
            <Dashboard onOpenSettings={openSettings} />
          )}
        </div>
      </main>

      <footer className="text-center text-secondary small py-3 px-3">
        Horasapp · Valores estimados con fines informativos, no constituyen liquidación oficial.
      </footer>

      <SettingsModal show={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
