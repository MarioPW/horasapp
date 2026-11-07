import { createContext } from 'preact';
import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import {
  loginWithEmail,
  loginWithGoogle,
  logout,
  registerWithEmail,
  watchAuth,
} from '../services/auth.js';
import { isFirebaseConfigured } from '../config/firebaseConfig.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return undefined;
    }
    // Resuelve la carga en el primer callback (sesión iniciada o no, o error)
    return watchAuth((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      loginWithEmail,
      loginWithGoogle,
      registerWithEmail,
      logout,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
