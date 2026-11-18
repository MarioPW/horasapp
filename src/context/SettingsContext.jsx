import { createContext } from 'preact';
import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { loadUserSettings, saveUserSettings } from '../services/userSettings.js';
import { resolveHourlyRate } from '../utils/payrollCalculator.js';
import { useAuth } from './AuthContext.jsx';

const SettingsContext = createContext(null);

/**
 * Datos laborales reales del usuario. `settings` es null hasta que la lectura
 * resuelve: nunca se puebla con valores por defecto (sin datos = sin cálculos).
 * `needsSetup` = usuario sin datos guardados → onboarding obligatorio.
 */
export function SettingsProvider({ children }) {
  const { user, configured } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!configured || !user) {
      setSettings(null);
      setLoading(false);
      setError('');
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setError('');
    loadUserSettings()
      .then((data) => {
        if (alive) setSettings(data ?? null); // null = usuario nuevo
      })
      .catch((e) => {
        if (!alive) return;
        setSettings(null);
        setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [configured, user, version]);

  const reload = () => setVersion((v) => v + 1);

  /** Guarda solo lo que el usuario ingresa (Firestore en sesión real; en memoria en demo). */
  const save = async (next) => {
    if (configured) await saveUserSettings(next);
    setSettings(next);
    return next;
  };

  // Onboarding: sin datos guardados o sin valor de pago configurado
  const needsSetup = !loading && !error && (settings === null || resolveHourlyRate(settings) <= 0);

  const value = useMemo(
    () => ({ settings, loading, error, reload, save, needsSetup }),
    [settings, loading, error, needsSetup],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
