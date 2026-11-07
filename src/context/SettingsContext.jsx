import { createContext } from 'preact';
import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { loadUserSettings, saveUserSettings } from '../services/userSettings.js';
import { DEFAULT_SETTINGS } from '../utils/constants.js';
import { useAuth } from './AuthContext.jsx';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { user, configured } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!configured || !user) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    loadUserSettings()
      .then((data) => alive && setSettings({ ...DEFAULT_SETTINGS, ...data }))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [configured, user]);

  const save = async (next) => {
    const merged = { ...DEFAULT_SETTINGS, ...next };
    await saveUserSettings(merged);
    setSettings(merged);
    return merged;
  };

  const value = useMemo(() => ({ settings, loading, save }), [settings, loading]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
