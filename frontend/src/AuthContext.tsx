import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { UNAUTHORIZED_EVENT } from './api';

export type AuthUser = { id: number; username: string };

export type AuthState = { status: 'loading' } | { status: 'anonymous' } | { status: 'user'; user: AuthUser };

type AuthContextValue = {
  state: AuthState;
  // Liefert null bei Erfolg, sonst eine anzeigbare Fehlermeldung.
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  // Nur im Demo-Modus: legt einen eigenen Demo-Benutzer mit Beispieldaten an und meldet ihn an.
  startDemo: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async (res) => {
        if (cancelled) return;
        setState(res.ok ? { status: 'user', user: await res.json() } : { status: 'anonymous' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'anonymous' });
      });

    const onUnauthorized = () => setState({ status: 'anonymous' });
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    let res: Response;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      return 'Server nicht erreichbar';
    }
    if (res.status === 401) return 'Benutzername oder Passwort falsch';
    if (res.status === 429) return 'Zu viele Versuche – bitte in ein paar Minuten erneut probieren';
    if (!res.ok) return `Fehler (${res.status})`;
    setState({ status: 'user', user: await res.json() });
    return null;
  }, []);

  const startDemo = useCallback(async () => {
    let res: Response;
    try {
      res = await fetch('/api/auth/demo', { method: 'POST' });
    } catch {
      return 'Server nicht erreichbar';
    }
    if (res.status === 429) return 'Zu viele Demo-Zugänge von dieser Adresse – bitte später erneut probieren';
    if (!res.ok) return `Fehler (${res.status})`;
    setState({ status: 'user', user: await res.json() });
    return null;
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setState({ status: 'anonymous' });
  }, []);

  const value = useMemo(() => ({ state, login, logout, startDemo }), [state, login, logout, startDemo]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth() ausserhalb von <AuthProvider>');
  return value;
}
