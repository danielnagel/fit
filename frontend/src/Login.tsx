import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from './AuthContext';
import MadeBy from './MadeBy';

export default function Login() {
  // config is null while loading, so the login form doesn't flash up on the demo instance.
  const { config, login, startDemo } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      {config?.demo && (
        <section className="card flex flex-col gap-3">
          <h2>Demo</h2>
          <p className="hint">
            Try Fit with example data: a training plan, a few past trainings and a running week.
            Your demo account and all changes are deleted after {config.ttlMinutes} minutes.
          </p>
          <button type="button" className="btn-primary" onClick={handleDemo} disabled={submitting}>
            Try the demo
          </button>
        </section>
      )}
      {/* The demo instance has no regular accounts, so only the demo entry is shown there. */}
      {config && !config.demo && (
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
      )}
      {config?.demo && <MadeBy className="mt-6" />}
    </main>
  );
}
