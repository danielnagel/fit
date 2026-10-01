import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from './AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      <form className="card flex flex-col gap-3" onSubmit={handleSubmit}>
        <h2 className="mb-1">Anmelden</h2>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <label className="flex flex-col gap-1">
          Benutzername
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
          Passwort
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
          {submitting ? 'Anmelden …' : 'Anmelden'}
        </button>
      </form>
    </main>
  );
}
