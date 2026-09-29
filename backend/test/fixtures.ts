import request from 'supertest';
import type { Express } from 'express';

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix} ${counter}`;
}

export async function createExercise(
  app: Express,
  overrides: { name?: string; description?: string | null; is_unilateral?: boolean } = {},
) {
  const res = await request(app)
    .post('/api/exercises')
    .send({
      name: overrides.name ?? unique('Übung'),
      description: overrides.description ?? null,
      is_unilateral: overrides.is_unilateral ?? false,
    });
  return res.body;
}

export async function createTrainingMethod(app: Express, overrides: Record<string, unknown> = {}) {
  const base = {
    name: unique('Methode'),
    scope: 'single',
    timing_family: 'fixed-window-remainder',
    window_seconds: 180,
    stop_condition: 'fixed-count',
    rounds: 3,
  };
  const res = await request(app)
    .post('/api/training-methods')
    .send({ ...base, ...overrides });
  return res.body;
}

export async function createPlan(
  app: Express,
  overrides: { name?: string; days?: unknown[] } = {},
) {
  const res = await request(app)
    .post('/api/plans')
    .send({ name: overrides.name ?? unique('Plan'), days: overrides.days ?? [] });
  return res.body;
}

export async function startWeek(app: Express, planId: number) {
  const res = await request(app).post('/api/plan-weeks').send({ plan_id: planId });
  return res.body;
}

export async function endWeek(app: Express, weekId: number) {
  return request(app).patch(`/api/plan-weeks/${weekId}`);
}
