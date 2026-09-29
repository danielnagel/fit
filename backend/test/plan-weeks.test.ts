import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createExercise, createPlan, createTrainingMethod, startWeek } from './fixtures.js';

const app = createApp();

describe('GET /api/plan-weeks/active', () => {
  it('returns null when no week is active', async () => {
    const res = await request(app).get('/api/plan-weeks/active');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

describe('POST /api/plan-weeks', () => {
  it('rejects a missing plan_id', async () => {
    const res = await request(app).post('/api/plan-weeks').send({});
    expect(res.status).toBe(400);
  });

  it('starts a week and makes it active', async () => {
    const plan = await createPlan(app, { name: 'Mein Plan' });

    const res = await request(app).post('/api/plan-weeks').send({ plan_id: plan.id });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ plan_id: plan.id, plan_name: 'Mein Plan', week_number: 1, sessions: [] });

    const active = await request(app).get('/api/plan-weeks/active');
    expect(active.body.id).toBe(res.body.id);
  });

  it('increments week_number for the same plan across started/ended weeks', async () => {
    const plan = await createPlan(app);
    const first = await startWeek(app, plan.id);
    await request(app).patch(`/api/plan-weeks/${first.id}`);

    const second = await startWeek(app, plan.id);

    expect(second.week_number).toBe(2);
  });

  it('rejects starting a week while one is already active', async () => {
    const plan = await createPlan(app);
    await startWeek(app, plan.id);

    const res = await request(app).post('/api/plan-weeks').send({ plan_id: plan.id });

    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/plan-weeks/:id', () => {
  it('ends the active week', async () => {
    const plan = await createPlan(app);
    const week = await startWeek(app, plan.id);

    const res = await request(app).patch(`/api/plan-weeks/${week.id}`);

    expect(res.status).toBe(204);
    const active = await request(app).get('/api/plan-weeks/active');
    expect(active.body).toBeNull();
  });

  it('returns 404 for an unknown or already-ended week', async () => {
    const res = await request(app).patch('/api/plan-weeks/999999');
    expect(res.status).toBe(404);
  });

  it('refuses to end a week with an in-progress session', async () => {
    const method = await createTrainingMethod(app);
    const exercise = await createExercise(app);
    const plan = await createPlan(app, {
      days: [{ name: 'Tag 1', blocks: [{ training_method_id: method.id, exercises: [{ exercise_id: exercise.id }] }] }],
    });
    const week = await startWeek(app, plan.id);
    const planDetail = await request(app).get(`/api/plans/${plan.id}`);
    await request(app)
      .post('/api/sessions')
      .send({ plan_day_id: planDetail.body.days[0].id });

    const res = await request(app).patch(`/api/plan-weeks/${week.id}`);

    expect(res.status).toBe(409);
  });
});
