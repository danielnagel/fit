import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';
import { assignData, createUser, deleteUser, listUsers, setPassword, type CliIo } from '../src/cli/userCommands.js';
import { createFullData, createPlan, createUser as createUserFixture, loginAgent, startWeek } from './fixtures.js';

const app = createApp();

function fakeIo(options: { isTTY?: boolean; answers?: string[] } = {}) {
  const answers = [...(options.answers ?? [])];
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    isTTY: options.isTTY ?? false,
    prompt: async () => answers.shift() ?? '',
    promptHidden: async () => answers.shift() ?? '',
  };
  return { io, out: () => out.join('\n'), err: () => err.join('\n') };
}

async function login(username: string, password: string) {
  return request(app).post('/api/auth/login').send({ username, password });
}

async function countOwned(userId: number) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM plans WHERE user_id = $1) AS plans,
       (SELECT count(*)::int FROM exercises WHERE user_id = $1) AS exercises,
       (SELECT count(*)::int FROM training_methods WHERE user_id = $1) AS training_methods,
       (SELECT count(*)::int FROM plan_weeks WHERE user_id = $1) AS plan_weeks`,
    [userId],
  );
  return rows[0];
}

async function userId(username: string) {
  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  return rows[0]?.id as number | undefined;
}

describe('user:create', () => {
  it('creates a user who can log in and seeds the default training methods', async () => {
    const { io, out } = fakeIo();

    expect(await createUser(io, { username: 'anna', password: 'secret123', seed: true })).toBe(0);

    expect(out()).toMatch(/User created: anna/);
    expect((await login('anna', 'secret123')).status).toBe(200);
    const { rows } = await pool.query('SELECT name FROM training_methods WHERE user_id = $1 ORDER BY name', [
      await userId('anna'),
    ]);
    expect(rows.map((r) => r.name)).toEqual([
      'Circuit interval',
      'High-intensity set',
      'Interval set',
      'Ladder set',
      'Superset',
    ]);
  });

  it('skips the seed with --no-seed', async () => {
    await createUser(fakeIo().io, { username: 'anna', password: 'secret123', seed: false });

    expect((await countOwned((await userId('anna'))!)).training_methods).toBe(0);
  });

  it('prompts interactively for username and password', async () => {
    const { io } = fakeIo({ isTTY: true, answers: ['anna', 'secret123', 'secret123'] });

    expect(await createUser(io, { seed: false })).toBe(0);
    expect((await login('anna', 'secret123')).status).toBe(200);
  });

  it.each([
    ['a too short password', { username: 'anna', password: 'short' }, /at least 8 characters/],
    ['an invalid username', { username: 'an na', password: 'secret123' }, /Invalid username/],
    ['missing arguments without a terminal', {}, /Usage/],
  ])('rejects %s', async (_label, args, message) => {
    const { io, err } = fakeIo();

    expect(await createUser(io, { ...args, seed: true })).toBe(1);
    expect(err()).toMatch(message);
    expect((await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n).toBe(1);
  });

  it('rejects mismatching interactive passwords', async () => {
    const { io, err } = fakeIo({ isTTY: true, answers: ['anna', 'secret123', 'other123'] });

    expect(await createUser(io, { seed: true })).toBe(1);
    expect(err()).toMatch(/do not match/);
  });

  it('rejects an existing username', async () => {
    await createUserFixture('anna');
    const { io, err } = fakeIo();

    expect(await createUser(io, { username: 'anna', password: 'secret123', seed: true })).toBe(1);
    expect(err()).toMatch(/already exists/);
  });
});

describe('user:list', () => {
  it('lists users with their data counts, the legacy user marked as without login', async () => {
    const anna = await createUserFixture('anna');
    await createFullData(await loginAgent(app, anna.username));
    const { io, out } = fakeIo();

    expect(await listUsers(io)).toBe(0);

    expect(out()).toMatch(/Default \(no login\) {2}\(id 1,/);
    expect(out()).toMatch(/anna .*last login 20\d\d.*1 plans, 1 exercises, 1 sessions/);
  });
});

describe('user:set-password', () => {
  it('replaces the password', async () => {
    await createUserFixture('anna');

    expect(await setPassword(fakeIo().io, { username: 'anna', password: 'new-password' })).toBe(0);

    expect((await login('anna', 'new-password')).status).toBe(200);
  });

  it('refuses the legacy default user', async () => {
    const { io, err } = fakeIo();

    expect(await setPassword(io, { username: 'Default', password: 'secret123' })).toBe(1);
    expect(err()).toMatch(/default user/);
  });
});

describe('user:delete', () => {
  it('deletes the user including all data', async () => {
    const anna = await createUserFixture('anna');
    await createFullData(await loginAgent(app, anna.username));

    expect(await deleteUser(fakeIo().io, { ref: 'anna', yes: true })).toBe(0);

    const { rows } = await pool.query(
      `SELECT (SELECT count(*)::int FROM users WHERE id = $1) AS users,
              (SELECT count(*)::int FROM exercises) AS exercises,
              (SELECT count(*)::int FROM logged_sets) AS logged_sets`,
      [anna.id],
    );
    expect(rows[0]).toEqual({ users: 0, exercises: 0, logged_sets: 0 });
  });

  it('requires --yes without a terminal', async () => {
    await createUserFixture('anna');
    const { io, err } = fakeIo();

    expect(await deleteUser(io, { ref: 'anna', yes: false })).toBe(1);
    expect(err()).toMatch(/--yes/);
    expect(await userId('anna')).toBeDefined();
  });

  it('aborts unless the confirmation is "yes"', async () => {
    await createUserFixture('anna');

    expect(await deleteUser(fakeIo({ isTTY: true, answers: ['no'] }).io, { ref: 'anna', yes: false })).toBe(1);
    expect(await userId('anna')).toBeDefined();
  });
});

describe('user:assign-data', () => {
  it('moves all data from the legacy default user to a new user', async () => {
    // State as after migration 0017: everything belongs to the default user (id 1).
    const source = await createUserFixture('source');
    const data = await createFullData(await loginAgent(app, source.username));
    for (const table of ['plans', 'exercises', 'training_methods', 'plan_weeks']) {
      await pool.query(`UPDATE ${table} SET user_id = 1`);
    }
    await createUserFixture('daniel');
    const { io, out } = fakeIo();

    expect(await assignData(io, { from: 'Default', to: 'daniel' })).toBe(0);

    expect(out()).toMatch(/plans: 1/);
    expect(out()).toMatch(/exercises: 1/);
    expect(await countOwned(1)).toEqual({ plans: 0, exercises: 0, training_methods: 0, plan_weeks: 0 });
    const agent = await loginAgent(app, 'daniel');
    const session = (await agent.get(`/api/sessions/${data.session.id}`)).body;
    expect(session.logged_sets).toEqual([expect.objectContaining({ id: data.loggedSet.id, reps: 8 })]);
    expect((await agent.get('/api/plan-weeks/active')).body.id).toBe(data.week.id);
  });

  it('aborts without changes on exercise name collisions and conflicting active weeks', async () => {
    const anna = await createUserFixture('anna');
    const bert = await createUserFixture('bert');
    await createFullData(await loginAgent(app, anna.username));
    const bertAgent = await loginAgent(app, bert.username);
    await createFullData(bertAgent);
    const before = { anna: await countOwned(anna.id), bert: await countOwned(bert.id) };
    const { io, err } = fakeIo();

    expect(await assignData(io, { from: 'anna', to: 'bert' })).toBe(1);

    expect(err()).toMatch(/active week/);
    expect(err()).toMatch(/Exercise "Squat"/);
    expect({ anna: await countOwned(anna.id), bert: await countOwned(bert.id) }).toEqual(before);
  });

  it('allows moving into a user with an active week if the source has none', async () => {
    const anna = await createUserFixture('anna');
    const bert = await createUserFixture('bert');
    const annaAgent = await loginAgent(app, anna.username);
    await createPlan(annaAgent);
    await startWeek(await loginAgent(app, bert.username), (await createPlan(await loginAgent(app, bert.username))).id);

    expect(await assignData(fakeIo().io, { from: 'anna', to: String(bert.id) })).toBe(0);
    expect((await countOwned(bert.id)).plans).toBe(2);
  });

  it('rejects identical or unknown users', async () => {
    await createUserFixture('anna');

    expect(await assignData(fakeIo().io, { from: 'anna', to: 'anna' })).toBe(1);
    expect(await assignData(fakeIo().io, { from: 'anna', to: 'nobody' })).toBe(1);
  });
});

describe('CLI entry point', () => {
  const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  function runCli(args: string[]) {
    return spawnSync(process.execPath, ['--import', 'tsx', 'src/cli/user.ts', ...args], {
      cwd: backendRoot,
      env: process.env,
      encoding: 'utf8',
    });
  }

  it('runs a command as a real process', async () => {
    const result = runCli(['create', 'anna', 'secret123', '--no-seed']);

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/User created: anna/);
    expect(await userId('anna')).toBeDefined();
  });

  it('prints the usage for unknown commands', () => {
    const result = runCli(['foo']);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/assign-data --from/);
  });
});
