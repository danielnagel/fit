import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createExercise, createPlan, createTrainingMethod, loginAgent, type Agent } from './fixtures.js';

const app = createApp();
let agent: Agent;

beforeEach(async () => {
  agent = await loginAgent(app);
});

describe('GET /api/exercises', () => {
  it('returns exercises sorted by name', async () => {
    await createExercise(agent, { name: 'Zebra-Übung' });
    await createExercise(agent, { name: 'Anfangs-Übung' });

    const res = await agent.get('/api/exercises');

    expect(res.status).toBe(200);
    expect(res.body.map((e: { name: string }) => e.name)).toEqual(['Anfangs-Übung', 'Zebra-Übung']);
  });
});

describe('POST /api/exercises', () => {
  it('creates an exercise', async () => {
    const res = await agent.post('/api/exercises').send({ name: 'Kniebeuge', description: 'mit Pause' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Kniebeuge', description: 'mit Pause', is_unilateral: false });
    expect(res.body.id).toBeTypeOf('number');
  });

  it('creates an exercise marked as unilateral', async () => {
    const res = await agent
      .post('/api/exercises')
      .send({ name: 'Einarmiges Rudern', is_unilateral: true });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ is_unilateral: true });
  });

  it('rejects a missing name', async () => {
    const res = await agent.post('/api/exercises').send({ description: 'ohne Namen' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name/);
  });

  it('rejects a duplicate name', async () => {
    await createExercise(agent, { name: 'Liegestütz' });

    const res = await agent.post('/api/exercises').send({ name: 'Liegestütz' });

    expect(res.status).toBe(409);
  });
});

describe('PUT /api/exercises/:id', () => {
  it('updates an exercise', async () => {
    const exercise = await createExercise(agent, { name: 'Altname' });

    const res = await agent
      .put(`/api/exercises/${exercise.id}`)
      .send({ name: 'Neuname', description: 'neu', is_unilateral: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Neuname', description: 'neu', is_unilateral: true });
  });

  it('returns 404 for an unknown id', async () => {
    const res = await agent.put('/api/exercises/999999').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('rejects a rename onto an existing name', async () => {
    await createExercise(agent, { name: 'Eins' });
    const other = await createExercise(agent, { name: 'Zwei' });

    const res = await agent.put(`/api/exercises/${other.id}`).send({ name: 'Eins' });

    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/exercises/:id', () => {
  it('deletes an unused exercise', async () => {
    const exercise = await createExercise(agent);

    const res = await agent.delete(`/api/exercises/${exercise.id}`);

    expect(res.status).toBe(204);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await agent.delete('/api/exercises/999999');
    expect(res.status).toBe(404);
  });

  it('refuses to delete an exercise still used in a plan', async () => {
    const exercise = await createExercise(agent);
    const method = await createTrainingMethod(agent);
    await createPlan(agent, {
      days: [
        {
          name: 'Tag 1',
          blocks: [{ training_method_id: method.id, exercises: [{ exercise_id: exercise.id }] }],
        },
      ],
    });

    const res = await agent.delete(`/api/exercises/${exercise.id}`);

    expect(res.status).toBe(409);
  });
});

describe('GET /api/exercises/:id/progress', () => {
  it('returns an empty array without logged sets', async () => {
    const exercise = await createExercise(agent);

    const res = await agent.get(`/api/exercises/${exercise.id}/progress`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
