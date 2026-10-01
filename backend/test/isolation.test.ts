import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createExercise, createPlan, createTrainingMethod, startWeek, loginAgent, type Agent } from './fixtures.js';

const app = createApp();
let alice: Agent;
let bob: Agent;

async function setupFullData(agent: Agent) {
  const method = await createTrainingMethod(agent);
  const exercise = await createExercise(agent, { name: 'Kniebeuge' });
  const plan = await createPlan(agent, {
    days: [{ name: 'Tag 1', blocks: [{ training_method_id: method.id, exercises: [{ exercise_id: exercise.id }] }] }],
  });
  const week = await startWeek(agent, plan.id);
  const planDayId = plan.days[0].id;
  const session = (await agent.post('/api/sessions').send({ plan_day_id: planDayId })).body;
  const loggedSet = (
    await agent.post(`/api/sessions/${session.id}/logged-sets`).send({ exercise_id: exercise.id, unit_index: 0, reps: 8 })
  ).body;
  return { method, exercise, plan, week, planDayId, session, loggedSet };
}

let data: Awaited<ReturnType<typeof setupFullData>>;

beforeEach(async () => {
  alice = await loginAgent(app);
  bob = await loginAgent(app);
  data = await setupFullData(alice);
});

describe('lists only contain own data', () => {
  it.each(['/api/exercises', '/api/training-methods', '/api/plans', '/api/sessions'])('%s', async (path) => {
    const res = await bob.get(path);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect((await alice.get(path)).body).toHaveLength(1);
  });

  it('/api/plan-weeks/active', async () => {
    expect((await bob.get('/api/plan-weeks/active')).body).toBeNull();
    expect((await alice.get('/api/plan-weeks/active')).body.id).toBe(data.week.id);
  });

  it('/api/exercises/:id/progress', async () => {
    await alice.patch(`/api/sessions/${data.session.id}`).send({ status: 'completed' });

    expect((await bob.get(`/api/exercises/${data.exercise.id}/progress`)).body).toEqual([]);
    expect((await alice.get(`/api/exercises/${data.exercise.id}/progress`)).body).toHaveLength(1);
  });
});

describe('foreign ids answer 404 and leave the data untouched', () => {
  it('exercises', async () => {
    const path = `/api/exercises/${data.exercise.id}`;

    expect((await bob.put(path).send({ name: 'gekapert' })).status).toBe(404);
    expect((await bob.delete(path)).status).toBe(404);
    expect((await alice.get('/api/exercises')).body[0].name).toBe('Kniebeuge');
  });

  it('training methods', async () => {
    const path = `/api/training-methods/${data.method.id}`;

    expect((await bob.get(path)).status).toBe(404);
    expect((await bob.put(path).send({ ...data.method, name: 'gekapert' })).status).toBe(404);
    expect((await bob.delete(path)).status).toBe(404);
    expect((await alice.get(path)).body.name).toBe(data.method.name);
  });

  it('plans', async () => {
    const path = `/api/plans/${data.plan.id}`;

    expect((await bob.get(path)).status).toBe(404);
    expect((await bob.put(path).send({ name: 'gekapert', days: [] })).status).toBe(404);
    expect((await bob.delete(path)).status).toBe(404);
    expect((await alice.get(path)).body.name).toBe(data.plan.name);
  });

  it('plan weeks', async () => {
    expect((await bob.post('/api/plan-weeks').send({ plan_id: data.plan.id })).status).toBe(404);
    expect((await bob.patch(`/api/plan-weeks/${data.week.id}`)).status).toBe(404);
    expect((await alice.get('/api/plan-weeks/active')).body.id).toBe(data.week.id);
  });

  it('sessions and their sub-resources', async () => {
    const base = `/api/sessions/${data.session.id}`;
    const setPath = `${base}/logged-sets/${data.loggedSet.id}`;

    const responses = [
      await bob.get(base),
      await bob.patch(base).send({ status: 'aborted' }),
      await bob.post(`${base}/logged-sets`).send({ exercise_id: data.exercise.id, unit_index: 1, reps: 5 }),
      await bob.patch(setPath).send({ reps: 99 }),
      await bob.delete(setPath),
      await bob.post(`${base}/finished-exercises`).send({ exercise_id: data.exercise.id }),
      await bob.put(`${base}/timer-anchor/primary`).send({ phase_key: 'x', duration_seconds: 10 }),
      await bob.delete(base),
    ];

    expect(responses.map((r) => r.status)).toEqual(Array(responses.length).fill(404));
    const session = (await alice.get(base)).body;
    expect(session.status).toBe('in_progress');
    expect(session.logged_sets).toEqual([expect.objectContaining({ id: data.loggedSet.id, reps: 8 })]);
    expect(session.finished_exercises).toEqual([]);
    expect(session.timer_anchors).toEqual({});
  });

  it('answers 404 instead of 500 for non-numeric session ids', async () => {
    expect((await alice.get('/api/sessions/abc')).status).toBe(404);
  });
});

describe('references to foreign data are rejected', () => {
  it('a plan cannot use a foreign exercise', async () => {
    const ownMethod = await createTrainingMethod(bob);

    const res = await bob.post('/api/plans').send({
      name: 'Plan',
      days: [{ name: 'Tag', blocks: [{ training_method_id: ownMethod.id, exercises: [{ exercise_id: data.exercise.id }] }] }],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('unbekannte exercise_id');
  });

  it('a plan cannot use a foreign training method', async () => {
    const ownExercise = await createExercise(bob);

    const res = await bob.post('/api/plans').send({
      name: 'Plan',
      days: [{ name: 'Tag', blocks: [{ training_method_id: data.method.id, exercises: [{ exercise_id: ownExercise.id }] }] }],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('unbekannte training_method_id');
  });

  it('an own session cannot log sets or finish exercises with a foreign exercise', async () => {
    const own = await setupFullData(bob);

    const logged = await bob
      .post(`/api/sessions/${own.session.id}/logged-sets`)
      .send({ exercise_id: data.exercise.id, unit_index: 1, reps: 5 });
    const finished = await bob
      .post(`/api/sessions/${own.session.id}/finished-exercises`)
      .send({ exercise_id: data.exercise.id });

    expect(logged.status).toBe(400);
    expect(finished.status).toBe(400);
  });
});

describe('per-user uniqueness', () => {
  it('allows the same exercise name for different users', async () => {
    const res = await bob.post('/api/exercises').send({ name: 'Kniebeuge' });

    expect(res.status).toBe(201);
  });

  it('allows an active week per user at the same time', async () => {
    const plan = await createPlan(bob);

    const res = await bob.post('/api/plan-weeks').send({ plan_id: plan.id });

    expect(res.status).toBe(201);
    expect((await alice.get('/api/plan-weeks/active')).body.id).toBe(data.week.id);
  });
});
