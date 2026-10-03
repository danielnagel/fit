import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';
import { deleteExpiredDemoUsers } from '../src/demo.js';
import { createFullData, createUser, loginAgent } from './fixtures.js';

const app = createApp();

afterEach(() => {
  vi.unstubAllEnvs();
});

async function startDemo() {
  vi.stubEnv('MODE', 'demo');
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/demo');
  return { agent, res };
}

async function expire(userId: number) {
  await pool.query("UPDATE users SET demo_expires_at = now() - interval '1 second' WHERE id = $1", [userId]);
}

describe('GET /api/auth/config', () => {
  it('reports whether demo mode is active', async () => {
    expect((await request(app).get('/api/auth/config')).body).toEqual({ demo: false, demo_ttl_minutes: 60 });

    vi.stubEnv('MODE', 'demo');
    expect((await request(app).get('/api/auth/config')).body.demo).toBe(true);
  });
});

describe('POST /api/auth/demo', () => {
  it('does not exist outside of demo mode', async () => {
    const res = await request(app).post('/api/auth/demo');

    expect(res.status).toBe(404);
    expect((await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n).toBe(1);
  });

  it('creates a logged-in demo user with example data and a one-hour cookie', async () => {
    const { agent, res } = await startDemo();

    expect(res.status).toBe(201);
    expect(res.body.username).toMatch(/^demo-[0-9a-f]{6}$/);
    expect(res.headers['set-cookie']?.[0]).toMatch(/Max-Age=3600/);
    expect((await agent.get('/api/auth/me')).body).toEqual(res.body);

    const plans = (await agent.get('/api/plans')).body;
    expect(plans).toHaveLength(1);
    expect(plans[0].day_count).toBe(2);
    expect((await agent.get('/api/exercises')).body).toHaveLength(6);
    expect((await agent.get('/api/training-methods')).body).toHaveLength(5);

    const sessions = (await agent.get('/api/sessions')).body;
    expect(sessions).toHaveLength(6);
    expect(sessions.every((s: { status: string }) => s.status === 'completed')).toBe(true);

    const activeWeek = (await agent.get('/api/plan-weeks/active')).body;
    expect(activeWeek.week_number).toBe(4);
    expect(activeWeek.sessions).toEqual([]);
  });

  it('produces history that shows progress and lets a training be started right away', async () => {
    const { agent } = await startDemo();
    const exercises = (await agent.get('/api/exercises')).body as { id: number; name: string }[];
    const squat = exercises.find((e) => e.name === 'Kniebeuge')!;

    const progress = (await agent.get(`/api/exercises/${squat.id}/progress`)).body as { max_reps: number }[];
    expect(progress.map((p) => p.max_reps)).toEqual([11, 12, 13]);

    const plan = (await agent.get(`/api/plans/${(await agent.get('/api/plans')).body[0].id}`)).body;
    const session = await agent.post('/api/sessions').send({ plan_day_id: plan.days[0].id });
    expect(session.status).toBe(201);
    // Rekord aus der Stufensatz-Historie (Woche 3: 6 Stufen, Index 0-5).
    expect(session.body.records).toEqual([expect.objectContaining({ max_stage: 5, best_reps: 6 })]);
    expect(session.body.previous_logged_sets.length).toBeGreaterThan(0);
  });

  it('isolates demo visitors from each other', async () => {
    const first = await startDemo();
    const second = await startDemo();

    const firstPlan = (await first.agent.get('/api/plans')).body[0];
    expect((await second.agent.get(`/api/plans/${firstPlan.id}`)).status).toBe(404);
  });

  it('cannot be used to log in with a password', async () => {
    const { res } = await startDemo();

    const login = await request(app).post('/api/auth/login').send({ username: res.body.username, password: '!demo' });

    expect(login.status).toBe(401);
  });
});

describe('demo expiry', () => {
  it('rejects the cookie of an expired demo user', async () => {
    const { agent, res } = await startDemo();
    await expire(res.body.id);

    expect((await agent.get('/api/plans')).status).toBe(401);
  });

  it('deletes expired demo users with all their data, but nobody else', async () => {
    const expired = await startDemo();
    const active = await startDemo();
    const regular = await createUser('anna');
    await createFullData(await loginAgent(app, regular.username));
    await expire(expired.res.body.id);

    expect(await deleteExpiredDemoUsers()).toBe(1);

    const { rows } = await pool.query('SELECT username FROM users WHERE username IS NOT NULL ORDER BY id');
    expect(rows.map((r) => r.username)).toEqual([active.res.body.username, 'anna']);
    const leftovers = await pool.query('SELECT count(*)::int AS n FROM plans WHERE user_id = $1', [expired.res.body.id]);
    expect(leftovers.rows[0].n).toBe(0);
  });
});
