import request from 'supertest';
import type { Express } from 'express';
import { pool } from '../src/db.js';
import { hashPassword } from '../src/auth/password.js';

export type Agent = request.Agent;

export const TEST_PASSWORD = 'test-password';
// scrypt ist absichtlich langsam; der Hash wird einmal pro Testlauf berechnet und wiederverwendet.
const testPasswordHash = hashPassword(TEST_PASSWORD);

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix} ${counter}`;
}

export async function createUser(username = unique('user').replace(' ', '-')) {
  const { rows } = await pool.query<{ id: number; username: string }>(
    'INSERT INTO users (name, username, password_hash) VALUES ($1, $1, $2) RETURNING id, username',
    [username, await testPasswordHash],
  );
  return rows[0];
}

// Liefert einen supertest-Agent, der das Login-Cookie traegt; ohne username wird ein neuer User angelegt.
export async function loginAgent(app: Express, username?: string): Promise<Agent> {
  const user = username ?? (await createUser()).username;
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ username: user, password: TEST_PASSWORD });
  if (res.status !== 200) throw new Error(`Test-Login fehlgeschlagen: ${JSON.stringify(res.body)}`);
  return agent;
}

export async function createExercise(
  agent: Agent,
  overrides: { name?: string; description?: string | null; is_unilateral?: boolean } = {},
) {
  const res = await agent
    .post('/api/exercises')
    .send({
      name: overrides.name ?? unique('Übung'),
      description: overrides.description ?? null,
      is_unilateral: overrides.is_unilateral ?? false,
    });
  return res.body;
}

export async function createTrainingMethod(agent: Agent, overrides: Record<string, unknown> = {}) {
  const base = {
    name: unique('Methode'),
    scope: 'single',
    timing_family: 'fixed-window-remainder',
    window_seconds: 180,
    stop_condition: 'fixed-count',
    rounds: 3,
  };
  const res = await agent
    .post('/api/training-methods')
    .send({ ...base, ...overrides });
  return res.body;
}

export async function createPlan(
  agent: Agent,
  overrides: { name?: string; days?: unknown[] } = {},
) {
  const res = await agent
    .post('/api/plans')
    .send({ name: overrides.name ?? unique('Plan'), days: overrides.days ?? [] });
  return res.body;
}

export async function startWeek(agent: Agent, planId: number) {
  const res = await agent.post('/api/plan-weeks').send({ plan_id: planId });
  return res.body;
}

export async function endWeek(agent: Agent, weekId: number) {
  return agent.patch(`/api/plan-weeks/${weekId}`);
}
