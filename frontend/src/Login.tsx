import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from './AuthContext';

export default function Login() {
  const { login, startDemo } = useAuth();
  const [demo, setDemo] = useState<{ ttlMinutes: number } | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/auth/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((config) => {
        if (config?.demo) setDemo({ ttlMinutes: config.demo_ttl_minutes });
      })
      .catch(() => undefined);
  }, []);

  const handleDemo = async () => {
    setError(null);
    setSubmitting(true);
    const message = await startDemo();
    setSubmitting(false);
    if (message) setError(message);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const message = await login(username, password);
    setSubmitting(false);
    if (message) {
      setError(message);
      setPassword('');
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="mb-6 flex items-center justify-center gap-2.5">
        <img src="/logo.svg" alt="" className="h-10 w-10" />
        <span className="text-xl font-semibold tracking-tight text-fg">Fit</span>
      </div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      )}
      {demo && (
        <section className="card mb-4 flex flex-col gap-3">
          <h2>Demo</h2>
          <p className="hint">
            Try Fit with example data: a training plan, a few past trainings and a running week.
            Your demo account and all changes are deleted after {demo.ttlMinutes} minutes.
          </p>
          <button type="button" className="btn-primary" onClick={handleDemo} disabled={submitting}>
            Try the demo
          </button>
        </section>
      )}
      <form className="card flex flex-col gap-3" onSubmit={handleSubmit}>
        <h2 className="mb-1">Log in</h2>
        <label className="flex flex-col gap-1">
          Username
          <input
            className="field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          Password
          <input
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" className="btn-primary mt-2" disabled={submitting}>
          {submitting ? 'Logging in …' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
