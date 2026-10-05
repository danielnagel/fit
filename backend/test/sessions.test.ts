import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createExercise, createPlan, createTrainingMethod, startWeek, loginAgent, type Agent } from './fixtures.js';

const app = createApp();
let agent: Agent;

beforeEach(async () => {
  agent = await loginAgent(app);
});

async function setupPlanWithDay(
  overrides: {
    methodOverrides?: Record<string, unknown>;
    isUnilateral?: boolean;
    isUnilateralActive?: boolean;
  } = {},
) {
  const method = await createTrainingMethod(agent, overrides.methodOverrides);
  const exercise = await createExercise(agent, { is_unilateral: overrides.isUnilateral ?? false });
  const plan = await createPlan(agent, {
    days: [
      {
        name: 'Day 1',
        blocks: [
          {
            training_method_id: method.id,
            exercises: [{ exercise_id: exercise.id, is_unilateral_active: overrides.isUnilateralActive ?? false }],
          },
        ],
      },
    ],
  });
  const week = await startWeek(agent, plan.id);
  const planDetail = await agent.get(`/api/plans/${plan.id}`);
  const planDayId = planDetail.body.days[0].id;
  return { method, exercise, plan, week, planDayId };
}

describe('POST /api/sessions', () => {
  it('rejects a missing plan_day_id', async () => {
    const res = await agent.post('/api/sessions').send({});
    expect(res.status).toBe(400);
  });

  it('rejects starting a session without an active week', async () => {
    const res = await agent.post('/api/sessions').send({ plan_day_id: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/active week/);
  });

  it('rejects a plan_day_id that does not belong to the active week\'s plan', async () => {
    await setupPlanWithDay();
    const otherPlan = await createPlan(agent);

    const res = await agent.post('/api/sessions').send({ plan_day_id: otherPlan.id });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not belong/);
  });

  it('creates a session with a frozen day snapshot', async () => {
    const { planDayId, method, exercise } = await setupPlanWithDay();

    const res = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('in_progress');
    expect(res.body.day_snapshot.name).toBe('Day 1');
    expect(res.body.day_snapshot.blocks).toHaveLength(1);
    expect(res.body.day_snapshot.blocks[0].training_method.name).toBe(method.name);
    expect(res.body.day_snapshot.blocks[0].exercises[0].exercise_id).toBe(exercise.id);
    expect(res.body.logged_sets).toEqual([]);
    expect(res.body.previous_logged_sets).toEqual([]);
    expect(res.body.records).toEqual([]);
    expect(res.body.finished_exercises).toEqual([]);
    expect(res.body.timer_anchors).toEqual({});
  });

  it('carries is_unilateral_active from the plan into the day snapshot', async () => {
    const { planDayId } = await setupPlanWithDay({ isUnilateral: true, isUnilateralActive: true });

    const res = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    expect(res.body.day_snapshot.blocks[0].exercises[0].is_unilateral_active).toBe(true);
  });
});

describe('GET /api/sessions', () => {
  it('filters by plan_week_id and status', async () => {
    const { planDayId, week } = await setupPlanWithDay();
    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    const byWeek = await agent.get('/api/sessions').query({ plan_week_id: week.id });
    expect(byWeek.body.map((s: { id: number }) => s.id)).toEqual([session.body.id]);

    const byStatus = await agent.get('/api/sessions').query({ status: 'completed' });
    expect(byStatus.body).toEqual([]);
  });
});

describe('GET /api/sessions/:id', () => {
  it('returns 404 for an unknown id', async () => {
    const res = await agent.get('/api/sessions/999999');
    expect(res.status).toBe(404);
  });
});

describe('logged-sets', () => {
  it('rejects missing exercise_id/unit_index', async () => {
    const { planDayId } = await setupPlanWithDay();
    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    const res = await agent.post(`/api/sessions/${session.body.id}/logged-sets`).send({});

    expect(res.status).toBe(400);
  });

  it('logs, updates and deletes a set', async () => {
    const { planDayId, exercise } = await setupPlanWithDay();
    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    const logged = await agent
      .post(`/api/sessions/${session.body.id}/logged-sets`)
      .send({ exercise_id: exercise.id, unit_index: 0, reps: 10 });
    expect(logged.status).toBe(201);
    expect(logged.body.reps).toBe(10);

    const detail = await agent.get(`/api/sessions/${session.body.id}`);
    expect(detail.body.logged_sets).toHaveLength(1);

    const updated = await agent
      .patch(`/api/sessions/${session.body.id}/logged-sets/${logged.body.id}`)
      .send({ reps: 12 });
    expect(updated.status).toBe(200);
    expect(updated.body.reps).toBe(12);

    const deleted = await agent.delete(`/api/sessions/${session.body.id}/logged-sets/${logged.body.id}`);
    expect(deleted.status).toBe(204);

    const missing = await agent.delete(`/api/sessions/${session.body.id}/logged-sets/${logged.body.id}`);
    expect(missing.status).toBe(404);
  });

  it('logs and updates the side of a set', async () => {
    const { planDayId, exercise } = await setupPlanWithDay({ isUnilateral: true, isUnilateralActive: true });
    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    const logged = await agent
      .post(`/api/sessions/${session.body.id}/logged-sets`)
      .send({ exercise_id: exercise.id, unit_index: 0, reps: 10, side: 'left' });
    expect(logged.status).toBe(201);
    expect(logged.body.side).toBe('left');

    const updated = await agent
      .patch(`/api/sessions/${session.body.id}/logged-sets/${logged.body.id}`)
      .send({ side: 'right' });
    expect(updated.status).toBe(200);
    expect(updated.body.side).toBe('right');
  });

  it('rejects an invalid side value', async () => {
    const { planDayId, exercise } = await setupPlanWithDay();
    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    const res = await agent
      .post(`/api/sessions/${session.body.id}/logged-sets`)
      .send({ exercise_id: exercise.id, unit_index: 0, reps: 10, side: 'up' });

    expect(res.status).toBe(400);
  });
});

describe('plan_block_exercise_id (same exercise reused across pairs of a block)', () => {
  it('gives each occurrence of a reused exercise a distinct plan_block_exercise_id in the snapshot', async () => {
    const method = await createTrainingMethod(agent, { scope: 'pair', rounds: 2 });
    const a = await createExercise(agent);
    const b = await createExercise(agent);
    // "a" is interlinked with three pairs, exactly like the door pull in the case reported in practice.
    const plan = await createPlan(agent, {
      days: [
        {
          name: 'Day 1',
          blocks: [
            {
              training_method_id: method.id,
              exercises: [
                { exercise_id: a.id },
                { exercise_id: b.id },
                { exercise_id: a.id },
                { exercise_id: b.id },
              ],
            },
          ],
        },
      ],
    });
    await startWeek(agent, plan.id);
    const planDetail = await agent.get(`/api/plans/${plan.id}`);
    const planDayId = planDetail.body.days[0].id;

    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });
    const exercises = session.body.day_snapshot.blocks[0].exercises as { plan_block_exercise_id: number }[];
    const ids = exercises.map((e) => e.plan_block_exercise_id);
    expect(new Set(ids).size).toBe(4);
    expect(ids.every((id: number) => Number.isInteger(id))).toBe(true);
  });

  it('round-trips plan_block_exercise_id through logged-sets', async () => {
    const method = await createTrainingMethod(agent, { scope: 'pair', rounds: 2 });
    const a = await createExercise(agent);
    const plan = await createPlan(agent, {
      days: [
        {
          name: 'Day 1',
          blocks: [{ training_method_id: method.id, exercises: [{ exercise_id: a.id }, { exercise_id: a.id }] }],
        },
      ],
    });
    await startWeek(agent, plan.id);
    const planDetail = await agent.get(`/api/plans/${plan.id}`);
    const planDayId = planDetail.body.days[0].id;
    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });
    const [slot0, slot1] = session.body.day_snapshot.blocks[0].exercises as { plan_block_exercise_id: number }[];

    const logged = await agent
      .post(`/api/sessions/${session.body.id}/logged-sets`)
      .send({ exercise_id: a.id, plan_block_exercise_id: slot1.plan_block_exercise_id, unit_index: 0, reps: 10 });
    expect(logged.status).toBe(201);
    expect(logged.body.plan_block_exercise_id).toBe(slot1.plan_block_exercise_id);
    expect(logged.body.plan_block_exercise_id).not.toBe(slot0.plan_block_exercise_id);

    const detail = await agent.get(`/api/sessions/${session.body.id}`);
    expect(detail.body.logged_sets[0].plan_block_exercise_id).toBe(slot1.plan_block_exercise_id);
  });
});

describe('finished-exercises', () => {
  it('marks an exercise as finished idempotently (legacy, no plan_block_exercise_id)', async () => {
    const { planDayId, exercise } = await setupPlanWithDay();
    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    const first = await agent
      .post(`/api/sessions/${session.body.id}/finished-exercises`)
      .send({ exercise_id: exercise.id });
    expect(first.status).toBe(201);
    expect(first.body.finished_exercises).toEqual([{ exercise_id: exercise.id, plan_block_exercise_id: null }]);

    const second = await agent
      .post(`/api/sessions/${session.body.id}/finished-exercises`)
      .send({ exercise_id: exercise.id });
    expect(second.status).toBe(201);
    expect(second.body.finished_exercises).toEqual([{ exercise_id: exercise.id, plan_block_exercise_id: null }]);
  });

  it('marks a specific slot as finished idempotently', async () => {
    const { planDayId, exercise } = await setupPlanWithDay();
    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });
    const slotId = session.body.day_snapshot.blocks[0].exercises[0].plan_block_exercise_id;

    const first = await agent
      .post(`/api/sessions/${session.body.id}/finished-exercises`)
      .send({ exercise_id: exercise.id, plan_block_exercise_id: slotId });
    expect(first.status).toBe(201);
    expect(first.body.finished_exercises).toEqual([{ exercise_id: exercise.id, plan_block_exercise_id: slotId }]);

    const second = await agent
      .post(`/api/sessions/${session.body.id}/finished-exercises`)
      .send({ exercise_id: exercise.id, plan_block_exercise_id: slotId });
    expect(second.status).toBe(201);
    expect(second.body.finished_exercises).toEqual([{ exercise_id: exercise.id, plan_block_exercise_id: slotId }]);
  });

  // Regression: the same exercise (only distinguished by the variant/note stored in the slot)
  // appears several times in the same block -- each slot must be markable as "done" independently,
  // exercise_id alone must not block that.
  it('lets the same reused exercise be finished independently per slot', async () => {
    const method = await createTrainingMethod(agent, {
      scope: 'all',
      timing_family: 'self-paced',
      rest_formula: 'fixed',
      rest_seconds: 10,
      stop_condition: 'all-exercises-done',
    });
    const a = await createExercise(agent);
    const plan = await createPlan(agent, {
      days: [
        {
          name: 'Day 1',
          blocks: [
            {
              training_method_id: method.id,
              exercises: [{ exercise_id: a.id, note: 'leicht' }, { exercise_id: a.id, note: 'schwer' }],
            },
          ],
        },
      ],
    });
    await startWeek(agent, plan.id);
    const planDetail = await agent.get(`/api/plans/${plan.id}`);
    const planDayId = planDetail.body.days[0].id;
    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });
    const [slot0, slot1] = session.body.day_snapshot.blocks[0].exercises as { plan_block_exercise_id: number }[];
    expect(slot0.plan_block_exercise_id).not.toBe(slot1.plan_block_exercise_id);

    const finishedFirst = await agent
      .post(`/api/sessions/${session.body.id}/finished-exercises`)
      .send({ exercise_id: a.id, plan_block_exercise_id: slot0.plan_block_exercise_id });
    expect(finishedFirst.body.finished_exercises).toEqual([
      { exercise_id: a.id, plan_block_exercise_id: slot0.plan_block_exercise_id },
    ]);

    const finishedSecond = await agent
      .post(`/api/sessions/${session.body.id}/finished-exercises`)
      .send({ exercise_id: a.id, plan_block_exercise_id: slot1.plan_block_exercise_id });
    expect(finishedSecond.body.finished_exercises).toHaveLength(2);
    expect(finishedSecond.body.finished_exercises).toEqual(
      expect.arrayContaining([
        { exercise_id: a.id, plan_block_exercise_id: slot0.plan_block_exercise_id },
        { exercise_id: a.id, plan_block_exercise_id: slot1.plan_block_exercise_id },
      ]),
    );
  });
});

describe('timer-anchor', () => {
  it('rejects an invalid slot', async () => {
    const { planDayId } = await setupPlanWithDay();
    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    const res = await agent
      .put(`/api/sessions/${session.body.id}/timer-anchor/tertiary`)
      .send({ phase_key: 'work', duration_seconds: 30 });

    expect(res.status).toBe(400);
  });

  it('rejects missing phase_key/duration_seconds', async () => {
    const { planDayId } = await setupPlanWithDay();
    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    const res = await agent.put(`/api/sessions/${session.body.id}/timer-anchor/primary`).send({});

    expect(res.status).toBe(400);
  });

  it('upserts a timer anchor', async () => {
    const { planDayId } = await setupPlanWithDay();
    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    const first = await agent
      .put(`/api/sessions/${session.body.id}/timer-anchor/primary`)
      .send({ phase_key: 'work', duration_seconds: 30 });
    expect(first.status).toBe(204);

    const second = await agent
      .put(`/api/sessions/${session.body.id}/timer-anchor/primary`)
      .send({ phase_key: 'rest', duration_seconds: 15 });
    expect(second.status).toBe(204);

    const detail = await agent.get(`/api/sessions/${session.body.id}`);
    expect(detail.body.timer_anchors.primary).toMatchObject({ phase_key: 'rest', duration_seconds: 15 });
  });
});

describe('PATCH /api/sessions/:id (status transitions)', () => {
  it('rejects an invalid status', async () => {
    const { planDayId } = await setupPlanWithDay();
    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    const res = await agent.patch(`/api/sessions/${session.body.id}`).send({ status: 'nope' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await agent.patch('/api/sessions/999999').send({ status: 'completed' });
    expect(res.status).toBe(404);
  });

  it('completing a session sets completed_at, resuming clears it', async () => {
    const { planDayId } = await setupPlanWithDay();
    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    const completed = await agent.patch(`/api/sessions/${session.body.id}`).send({ status: 'completed' });
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe('completed');
    expect(completed.body.completed_at).toBeTruthy();

    const resumed = await agent.patch(`/api/sessions/${session.body.id}`).send({ status: 'in_progress' });
    expect(resumed.body.completed_at).toBeNull();
  });
});

describe('DELETE /api/sessions/:id', () => {
  it('deletes a session', async () => {
    const { planDayId } = await setupPlanWithDay();
    const session = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    const res = await agent.delete(`/api/sessions/${session.body.id}`);
    expect(res.status).toBe(204);

    const missing = await agent.delete(`/api/sessions/${session.body.id}`);
    expect(missing.status).toBe(404);
  });
});

describe('previous_logged_sets and records across sessions', () => {
  it('surfaces the previous completed session\'s sets for the same plan day', async () => {
    const { planDayId, exercise } = await setupPlanWithDay();

    const first = await agent.post('/api/sessions').send({ plan_day_id: planDayId });
    await agent
      .post(`/api/sessions/${first.body.id}/logged-sets`)
      .send({ exercise_id: exercise.id, unit_index: 0, reps: 8 });
    await agent.patch(`/api/sessions/${first.body.id}`).send({ status: 'completed' });

    const second = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    expect(second.body.previous_logged_sets).toEqual([
      expect.objectContaining({ exercise_id: exercise.id, unit_index: 0, reps: 8 }),
    ]);
  });

  it('only surfaces stage records for self-paced blocks', async () => {
    const { planDayId, exercise } = await setupPlanWithDay({
      methodOverrides: {
        timing_family: 'self-paced',
        rest_formula: 'fixed',
        rest_seconds: 10,
        stop_condition: 'all-exercises-done',
      },
    });

    const first = await agent.post('/api/sessions').send({ plan_day_id: planDayId });
    await agent
      .post(`/api/sessions/${first.body.id}/logged-sets`)
      .send({ exercise_id: exercise.id, unit_index: 3, reps: 15 });
    await agent.patch(`/api/sessions/${first.body.id}`).send({ status: 'completed' });

    const second = await agent.post('/api/sessions').send({ plan_day_id: planDayId });

    expect(second.body.records).toEqual([
      expect.objectContaining({ exercise_id: exercise.id, max_stage: 3, best_reps: 15 }),
    ]);
  });
});
