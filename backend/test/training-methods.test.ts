import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createPlan, createExercise, createTrainingMethod } from './fixtures.js';

const app = createApp();

describe('GET /api/training-methods', () => {
  it('lists methods sorted by name', async () => {
    await createTrainingMethod(app, { name: 'Zeta' });
    await createTrainingMethod(app, { name: 'Alpha' });

    const res = await request(app).get('/api/training-methods');

    expect(res.status).toBe(200);
    expect(res.body.map((m: { name: string }) => m.name)).toEqual(['Alpha', 'Zeta']);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/api/training-methods/999999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/training-methods validation', () => {
  const base = { name: 'Test', scope: 'single', stop_condition: 'fixed-count', rounds: 3 };

  it('rejects a missing name', async () => {
    const res = await request(app)
      .post('/api/training-methods')
      .send({ ...base, name: '', timing_family: 'fixed-window-remainder', window_seconds: 60 });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid scope', async () => {
    const res = await request(app)
      .post('/api/training-methods')
      .send({ ...base, scope: 'nope', timing_family: 'fixed-window-remainder', window_seconds: 60 });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid timing_family', async () => {
    const res = await request(app).post('/api/training-methods').send({ ...base, timing_family: 'nope' });
    expect(res.status).toBe(400);
  });

  it('requires window_seconds for fixed-window-remainder', async () => {
    const res = await request(app)
      .post('/api/training-methods')
      .send({ ...base, timing_family: 'fixed-window-remainder' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/window_seconds/);
  });

  it('requires work_seconds and rest_seconds for fixed-work-rest', async () => {
    const res = await request(app).post('/api/training-methods').send({ ...base, timing_family: 'fixed-work-rest' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/work_seconds/);

    const res2 = await request(app)
      .post('/api/training-methods')
      .send({ ...base, timing_family: 'fixed-work-rest', work_seconds: 20 });
    expect(res2.status).toBe(400);
    expect(res2.body.message).toMatch(/rest_seconds/);
  });

  it('requires rest_formula for self-paced, plus rest_factor/rest_seconds depending on formula', async () => {
    const noFormula = await request(app).post('/api/training-methods').send({ ...base, timing_family: 'self-paced' });
    expect(noFormula.status).toBe(400);
    expect(noFormula.body.message).toMatch(/rest_formula/);

    const proportionalNoFactor = await request(app)
      .post('/api/training-methods')
      .send({ ...base, timing_family: 'self-paced', rest_formula: 'proportional' });
    expect(proportionalNoFactor.status).toBe(400);
    expect(proportionalNoFactor.body.message).toMatch(/rest_factor/);

    const fixedNoSeconds = await request(app)
      .post('/api/training-methods')
      .send({ ...base, timing_family: 'self-paced', rest_formula: 'fixed' });
    expect(fixedNoSeconds.status).toBe(400);
    expect(fixedNoSeconds.body.message).toMatch(/rest_seconds/);
  });

  it('requires rounds for stop_condition fixed-count and total_duration_seconds for time-budget', async () => {
    const noRounds = await request(app)
      .post('/api/training-methods')
      .send({
        name: 'Test',
        scope: 'single',
        timing_family: 'fixed-window-remainder',
        window_seconds: 60,
        stop_condition: 'fixed-count',
      });
    expect(noRounds.status).toBe(400);
    expect(noRounds.body.message).toMatch(/rounds/);

    const noBudget = await request(app)
      .post('/api/training-methods')
      .send({
        name: 'Test',
        scope: 'single',
        timing_family: 'fixed-window-remainder',
        window_seconds: 60,
        stop_condition: 'time-budget',
      });
    expect(noBudget.status).toBe(400);
    expect(noBudget.body.message).toMatch(/total_duration_seconds/);
  });
});

describe('POST /api/training-methods normalization', () => {
  it('nulls out fields irrelevant to the chosen timing_family/stop_condition', async () => {
    const res = await request(app).post('/api/training-methods').send({
      name: 'Fenster-Methode',
      scope: 'single',
      timing_family: 'fixed-window-remainder',
      window_seconds: 90,
      work_seconds: 999,
      rest_seconds: 999,
      stop_condition: 'time-budget',
      total_duration_seconds: 600,
      rounds: 999,
    });

    expect(res.status).toBe(201);
    expect(res.body.window_seconds).toBe(90);
    expect(res.body.work_seconds).toBeNull();
    expect(res.body.rest_seconds).toBeNull();
    expect(res.body.rounds).toBeNull();
    expect(res.body.total_duration_seconds).toBe(600);
  });
});

describe('PUT /api/training-methods/:id', () => {
  it('updates a method', async () => {
    const method = await createTrainingMethod(app, { name: 'Alt' });

    const res = await request(app)
      .put(`/api/training-methods/${method.id}`)
      .send({
        name: 'Neu',
        scope: 'single',
        timing_family: 'fixed-window-remainder',
        window_seconds: 120,
        stop_condition: 'fixed-count',
        rounds: 5,
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Neu', window_seconds: 120, rounds: 5 });
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .put('/api/training-methods/999999')
      .send({
        name: 'Neu',
        scope: 'single',
        timing_family: 'fixed-window-remainder',
        window_seconds: 120,
        stop_condition: 'fixed-count',
        rounds: 5,
      });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/training-methods/:id', () => {
  it('deletes an unused method', async () => {
    const method = await createTrainingMethod(app);
    const res = await request(app).delete(`/api/training-methods/${method.id}`);
    expect(res.status).toBe(204);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/api/training-methods/999999');
    expect(res.status).toBe(404);
  });

  it('refuses to delete a method still used in a plan', async () => {
    const method = await createTrainingMethod(app);
    const exercise = await createExercise(app);
    await createPlan(app, {
      days: [
        {
          name: 'Tag 1',
          blocks: [{ training_method_id: method.id, exercises: [{ exercise_id: exercise.id }] }],
        },
      ],
    });

    const res = await request(app).delete(`/api/training-methods/${method.id}`);

    expect(res.status).toBe(409);
  });
});
