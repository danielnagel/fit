import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { UNAUTHORIZED_EVENT } from './api';

export type AuthUser = { id: number; username: string };

// Instance settings from /api/auth/config; null while loading.
export type AuthConfig = { demo: boolean; ttlMinutes: number };

export type AuthState = { status: 'loading' } | { status: 'anonymous' } | { status: 'user'; user: AuthUser };

type AuthContextValue = {
  state: AuthState;
  config: AuthConfig | null;
  // Returns null on success, otherwise a displayable error message.
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  // Demo mode only: creates a separate demo user with example data and logs it in.
  startDemo: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [config, setConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    fetch('/api/auth/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setConfig({ demo: Boolean(body?.demo), ttlMinutes: body?.demo_ttl_minutes ?? 0 }))
      .catch(() => setConfig({ demo: false, ttlMinutes: 0 }));
  }, []);

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
      return 'Server not reachable';
    }
    if (res.status === 401) return 'Wrong username or password';
    if (res.status === 429) return 'Too many attempts – please try again in a few minutes';
    if (!res.ok) return `Error (${res.status})`;
    setState({ status: 'user', user: await res.json() });
    return null;
  }, []);

  const startDemo = useCallback(async () => {
    let res: Response;
    try {
      res = await fetch('/api/auth/demo', { method: 'POST' });
    } catch {
      return 'Server not reachable';
    }
    if (res.status === 429) return 'Too many demo accounts from this address – please try again later';
    if (!res.ok) return `Error (${res.status})`;
    setState({ status: 'user', user: await res.json() });
    return null;
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setState({ status: 'anonymous' });
  }, []);

  const value = useMemo(
    () => ({ state, config, login, logout, startDemo }),
    [state, config, login, logout, startDemo],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth() used outside of <AuthProvider>');
  return value;
}
