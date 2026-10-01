import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';
import { hashPassword, passwords } from '../src/auth/password.js';
import { TEST_PASSWORD, createUser, loginAgent } from './fixtures.js';

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function setCookieHeader(res: request.Response): string {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return (header ?? []).join('; ');
}

describe('password hashing', () => {
  it('verifies the correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('richtig-geheim');

    expect(hash).toMatch(/^scrypt\$\d+\$\d+\$\d+\$[^$]+\$[^$]+$/);
    expect(await passwords.verify('richtig-geheim', hash)).toBe(true);
    expect(await passwords.verify('falsch-geheim', hash)).toBe(false);
  });

  it('uses a fresh salt for every hash', async () => {
    expect(await hashPassword('gleich')).not.toBe(await hashPassword('gleich'));
  });

  it('rejects malformed stored hashes without throwing', async () => {
    expect(await passwords.verify('x', 'kein-hash')).toBe(false);
  });
});

describe('POST /api/auth/login', () => {
  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'nur-name' });

    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials and sets an httpOnly, strict session cookie', async () => {
    const user = await createUser('anna');

    const res = await request(app).post('/api/auth/login').send({ username: 'anna', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: user.id, username: 'anna' });
    const cookie = setCookieHeader(res);
    expect(cookie).toMatch(/token=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).not.toMatch(/Secure/);

    const { rows } = await pool.query('SELECT last_login_at FROM users WHERE id = $1', [user.id]);
    expect(rows[0].last_login_at).not.toBeNull();
  });

  it('marks the cookie as secure in production', async () => {
    await createUser('anna');
    vi.stubEnv('NODE_ENV', 'production');

    const res = await request(app).post('/api/auth/login').send({ username: 'anna', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(setCookieHeader(res)).toMatch(/Secure/);
  });

  it('rejects a wrong password after exactly one hash comparison', async () => {
    await createUser('anna');
    const verifySpy = vi.spyOn(passwords, 'verify');

    const res = await request(app).post('/api/auth/login').send({ username: 'anna', password: 'falsch' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_credentials' });
    expect(setCookieHeader(res)).not.toMatch(/token=/);
    expect(verifySpy).toHaveBeenCalledTimes(1);
  });

  it('compares against a dummy hash for unknown usernames (timing parity)', async () => {
    const verifySpy = vi.spyOn(passwords, 'verify');

    const res = await request(app).post('/api/auth/login').send({ username: 'niemand', password: 'egal' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_credentials' });
    expect(verifySpy).toHaveBeenCalledTimes(1);
    expect(verifySpy).toHaveBeenCalledWith('egal', passwords.dummyHash);
  });

  it('never logs in the legacy default user, which has no credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'Default', password: 'egal' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the logged-in user', async () => {
    const user = await createUser('anna');
    const agent = await loginAgent(app, 'anna');

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: user.id, username: 'anna' });
  });

  it('rejects requests without a cookie', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'not_authenticated' });
  });

  it('rejects a token signed with a different secret', async () => {
    const user = await createUser('anna');
    const forged = jwt.sign({ sub: String(user.id), username: 'anna' }, 'falsches-secret');

    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${forged}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'session_expired' });
  });

  it('rejects a still valid token once the user has been deleted', async () => {
    const user = await createUser('anna');
    const agent = await loginAgent(app, 'anna');
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('rejects a validly signed token for the legacy default user', async () => {
    const token = jwt.sign({ sub: '1', username: 'Default' }, process.env.JWT_SECRET!);

    const res = await request(app).get('/api/exercises').set('Cookie', `token=${token}`);

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the session cookie', async () => {
    await createUser('anna');
    const agent = await loginAgent(app, 'anna');

    const res = await agent.post('/api/auth/logout');

    expect(res.status).toBe(204);
    expect(setCookieHeader(res)).toMatch(/token=;/);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('route protection', () => {
  it.each([
    ['get', '/api/exercises'],
    ['post', '/api/exercises'],
    ['get', '/api/training-methods'],
    ['get', '/api/plans'],
    ['get', '/api/plan-weeks/active'],
    ['get', '/api/sessions/1'],
  ] as const)('%s %s requires a login', async (method, path) => {
    const res = await request(app)[method](path);

    expect(res.status).toBe(401);
  });

  it('keeps the health check public', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
  });
});
