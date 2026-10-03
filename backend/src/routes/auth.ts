import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../db.js';
import { passwords } from '../auth/password.js';
import { AUTH_COOKIE, SESSION_MAX_AGE_MS, cookieOptions, signToken } from '../auth/jwt.js';
import { currentUser, requireAuth } from '../middleware/requireAuth.js';
import { DEMO_TTL_MS, createDemoUser, isDemoMode } from '../demo.js';

export const authRouter = Router();

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited' },
  // Vitest setzt NODE_ENV=test; die Tests loggen sich weit oefter als 10-mal ein.
  skip: () => process.env.NODE_ENV === 'test',
});

// Eigener Zaehler: legt pro Aufruf einen Benutzer samt Beispieldaten an.
const demoRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Oeffentlich: die Login-Seite blendet damit den Demo-Einstieg ein.
authRouter.get('/config', (_req, res) => {
  res.json({ demo: isDemoMode(), demo_ttl_minutes: DEMO_TTL_MS / 60000 });
});

authRouter.post('/demo', demoRateLimiter, async (_req, res) => {
  if (!isDemoMode()) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const user = await createDemoUser();
  res.cookie(AUTH_COOKIE, signToken(user, DEMO_TTL_MS), { ...cookieOptions(), maxAge: DEMO_TTL_MS });
  res.status(201).json(user);
});

authRouter.post('/login', loginRateLimiter, async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    res.status(400).json({ error: 'missing_fields' });
    return;
  }

  const { rows } = await pool.query<{ id: number; username: string; password_hash: string }>(
    'SELECT id, username, password_hash FROM users WHERE username = $1 AND password_hash IS NOT NULL',
    [username],
  );
  const user = rows[0];
  const passwordMatches = await passwords.verify(password, user?.password_hash ?? passwords.dummyHash);

  if (!user || !passwordMatches) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

  res.cookie(AUTH_COOKIE, signToken(user), { ...cookieOptions(), maxAge: SESSION_MAX_AGE_MS });
  res.json({ id: user.id, username: user.username });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json(currentUser(req));
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
  res.status(204).end();
});
