import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createExercise, createPlan, createTrainingMethod } from './fixtures.js';

const app = createApp();

async function singleScopeMethod() {
  return createTrainingMethod(app, {
    scope: 'single',
    timing_family: 'fixed-window-remainder',
    window_seconds: 60,
    stop_condition: 'fixed-count',
    rounds: 3,
  });
}

async function pairScopeMethod() {
  return createTrainingMethod(app, {
    scope: 'pair',
    timing_family: 'fixed-window-remainder',
    window_seconds: 60,
    stop_condition: 'fixed-count',
    rounds: 3,
  });
}

async function selfPacedMethod() {
  return createTrainingMethod(app, {
    scope: 'single',
    timing_family: 'self-paced',
    rest_formula: 'proportional',
    rest_factor: 1,
    stop_condition: 'time-budget',
    total_duration_seconds: 300,
  });
}

async function circuitMethod() {
  return createTrainingMethod(app, {
    scope: 'all',
    timing_family: 'self-paced',
    rest_formula: 'proportional',
    rest_factor: 0.5,
    stop_condition: 'time-budget',
    total_duration_seconds: 1200,
  });
}

async function fixedWorkRestMethod() {
  return createTrainingMethod(app, {
    scope: 'single',
    timing_family: 'fixed-work-rest',
    work_seconds: 20,
    rest_seconds: 10,
    stop_condition: 'fixed-count',
    rounds: 8,
  });
}

describe('POST /api/plans validation', () => {
  it('rejects a missing name', async () => {
    const res = await request(app).post('/api/plans').send({ days: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name/);
  });

  it('rejects a day without a name', async () => {
    const method = await singleScopeMethod();
    const exercise = await createExercise(app);
    const res = await request(app)
      .post('/api/plans')
      .send({
        name: 'Plan',
        days: [{ blocks: [{ training_method_id: method.id, exercises: [{ exercise_id: exercise.id }] }] }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Trainingstag/);
  });

  it('rejects a day without blocks', async () => {
    const res = await request(app)
      .post('/api/plans')
      .send({ name: 'Plan', days: [{ name: 'Tag 1', blocks: [] }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Block/);
  });

  it('rejects a block without a valid training_method_id', async () => {
    const res = await request(app)
      .post('/api/plans')
      .send({ name: 'Plan', days: [{ name: 'Tag 1', blocks: [{ exercises: [] }] }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/training_method_id/);
  });

  it('rejects an unknown training_method_id', async () => {
    const res = await request(app)
      .post('/api/plans')
      .send({ name: 'Plan', days: [{ name: 'Tag 1', blocks: [{ training_method_id: 999999, exercises: [] }] }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/training_method_id/);
  });

  it('rejects a pair-scope block with an odd number of exercises', async () => {
    const method = await pairScopeMethod();
    const exercise = await createExercise(app);
    const res = await request(app)
      .post('/api/plans')
      .send({
        name: 'Plan',
        days: [
          {
            name: 'Tag 1',
            blocks: [{ training_method_id: method.id, exercises: [{ exercise_id: exercise.id }] }],
          },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/gerade Anzahl/);
  });

  it('rejects a single-scope block without exercises', async () => {
    const method = await singleScopeMethod();
    const res = await request(app)
      .post('/api/plans')
      .send({ name: 'Plan', days: [{ name: 'Tag 1', blocks: [{ training_method_id: method.id, exercises: [] }] }] });
    expect(res.status).toBe(400);
  });

  it('rejects an exercise without exercise_id', async () => {
    const method = await singleScopeMethod();
    const res = await request(app)
      .post('/api/plans')
      .send({
        name: 'Plan',
        days: [{ name: 'Tag 1', blocks: [{ training_method_id: method.id, exercises: [{ note: 'x' }] }] }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/exercise_id/);
  });

  it('rejects is_unilateral_active on a scope-all block (Zirkel-Intervall)', async () => {
    const method = await circuitMethod();
    const exercise = await createExercise(app, { is_unilateral: true });
    const res = await request(app)
      .post('/api/plans')
      .send({
        name: 'Plan',
        days: [
          {
            name: 'Tag 1',
            blocks: [
              { training_method_id: method.id, exercises: [{ exercise_id: exercise.id, is_unilateral_active: true }] },
            ],
          },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Zirkel-Intervall/);
  });

  it('rejects is_unilateral_active for an exercise that is not marked as unilateral', async () => {
    const method = await singleScopeMethod();
    const exercise = await createExercise(app, { is_unilateral: false });
    const res = await request(app)
      .post('/api/plans')
      .send({
        name: 'Plan',
        days: [
          {
            name: 'Tag 1',
            blocks: [
              { training_method_id: method.id, exercises: [{ exercise_id: exercise.id, is_unilateral_active: true }] },
            ],
          },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/einseitig/);
  });
});

describe('POST /api/plans success', () => {
  it('creates a nested plan and returns the full detail structure', async () => {
    const method = await singleScopeMethod();
    const exercise = await createExercise(app, { name: 'Kniebeuge' });

    const res = await request(app)
      .post('/api/plans')
      .send({
        name: 'Ganzkörper',
        days: [
          {
            name: 'Tag 1',
            blocks: [
              {
                training_method_id: method.id,
                exercises: [{ exercise_id: exercise.id, reps_min: 8, reps_max: 12, note: 'locker' }],
              },
            ],
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Ganzkörper');
    expect(res.body.days).toHaveLength(1);
    const [day] = res.body.days;
    expect(day.name).toBe('Tag 1');
    expect(day.blocks).toHaveLength(1);
    const [block] = day.blocks;
    expect(block.training_method.id).toBe(method.id);
    expect(block.exercises).toEqual([
      expect.objectContaining({
        exercise_id: exercise.id,
        exercise_name: 'Kniebeuge',
        reps_min: 8,
        reps_max: 12,
        note: 'locker',
        is_unilateral_active: false,
      }),
    ]);
  });

  it('activates is_unilateral_active per exercise on a pair-scope block', async () => {
    const method = await pairScopeMethod();
    const heavy = await createExercise(app, { is_unilateral: true });
    const light = await createExercise(app, { is_unilateral: true });

    const res = await request(app)
      .post('/api/plans')
      .send({
        name: 'Plan',
        days: [
          {
            name: 'Tag 1',
            blocks: [
              {
                training_method_id: method.id,
                exercises: [
                  { exercise_id: heavy.id, is_unilateral_active: true },
                  { exercise_id: light.id, is_unilateral_active: false },
                ],
              },
            ],
          },
        ],
      });

    expect(res.status).toBe(201);
    const [block] = res.body.days[0].blocks;
    expect(block.exercises).toEqual([
      expect.objectContaining({ exercise_id: heavy.id, is_unilateral_active: true }),
      expect.objectContaining({ exercise_id: light.id, is_unilateral_active: false }),
    ]);
  });

  it.each([
    ['self-paced single-scope (Stufensatz)', selfPacedMethod],
    ['fixed-work-rest (Hochintensitätssatz)', fixedWorkRestMethod],
  ])('activates is_unilateral_active on a %s block', async (_label, methodFactory) => {
    const method = await methodFactory();
    const exercise = await createExercise(app, { is_unilateral: true });

    const res = await request(app)
      .post('/api/plans')
      .send({
        name: 'Plan',
        days: [
          {
            name: 'Tag 1',
            blocks: [
              { training_method_id: method.id, exercises: [{ exercise_id: exercise.id, is_unilateral_active: true }] },
            ],
          },
        ],
      });

    expect(res.status).toBe(201);
    const [block] = res.body.days[0].blocks;
    expect(block.exercises).toEqual([expect.objectContaining({ exercise_id: exercise.id, is_unilateral_active: true })]);
  });
});

describe('GET /api/plans', () => {
  it('lists plans newest first with a day count', async () => {
    const p1 = await createPlan(app, { name: 'Erster' });
    const p2 = await createPlan(app, { name: 'Zweiter' });

    const res = await request(app).get('/api/plans');

    expect(res.status).toBe(200);
    expect(res.body.map((p: { id: number }) => p.id)).toEqual([p2.id, p1.id]);
    expect(res.body[0].day_count).toBe(0);
  });
});

describe('GET /api/plans/:id', () => {
  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/api/plans/999999');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/plans/:id', () => {
  it('replaces all days of a plan', async () => {
    const method = await singleScopeMethod();
    const exercise = await createExercise(app);
    const plan = await createPlan(app, {
      days: [{ name: 'Alt', blocks: [{ training_method_id: method.id, exercises: [{ exercise_id: exercise.id }] }] }],
    });

    const res = await request(app)
      .put(`/api/plans/${plan.id}`)
      .send({
        name: plan.name,
        days: [{ name: 'Neu', blocks: [{ training_method_id: method.id, exercises: [{ exercise_id: exercise.id }] }] }],
      });

    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(1);
    expect(res.body.days[0].name).toBe('Neu');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).put('/api/plans/999999').send({ name: 'X', days: [] });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/plans/:id', () => {
  it('deletes a plan', async () => {
    const plan = await createPlan(app);
    const res = await request(app).delete(`/api/plans/${plan.id}`);
    expect(res.status).toBe(204);

    const getRes = await request(app).get(`/api/plans/${plan.id}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/api/plans/999999');
    expect(res.status).toBe(404);
  });
});
