import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from './db.js';
import { seedDefaultTrainingMethods } from './defaultTrainingMethods.js';
import { buildDaySnapshot } from './routes/sessions.js';
import { deleteUserWithData } from './users.js';
import type { AuthUser } from './auth/jwt.js';

// MODE=demo: public demo instance. Every visitor gets their own user with example data via "Try the
// demo" (isolation per user, see routes/), which is deleted again including all data after
// DEMO_TTL_MS. Demo users can't log in with a password.
export function isDemoMode() {
  return process.env.MODE === 'demo';
}

export const DEMO_TTL_MS = 10 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Not a valid scrypt hash: passwords.verify() always returns false for it, so a password login is
// impossible. users_login_complete still requires a value next to the username.
const NO_LOGIN_HASH = '!demo';

const DEMO_EXERCISES = [
  { name: 'Squat', description: 'Feet shoulder-width apart, knees over the toes, hips below knee height.' },
  { name: 'Push-ups', description: 'Body forms a straight line, chest down to just above the floor.' },
  { name: 'Pull-ups', description: 'From a dead hang until the chin is over the bar, lower under control.' },
  { name: 'Lunges', description: 'Big step forward, back knee almost down to the floor.' },
  { name: 'Table rows', description: 'Lie under a sturdy table, pull your chest up to the table edge.' },
  { name: 'Burpees', description: 'Squat, plank position, back into the squat, jump up.' },
];

// Day -> blocks (training method from the default catalog) -> exercises with target reps.
const DEMO_PLAN = {
  name: 'Full body (demo)',
  days: [
    {
      name: 'Full body A',
      blocks: [
        { method: 'Interval set', exercises: [['Squat', 10, 15], ['Push-ups', 8, 12]] },
        { method: 'Ladder set', exercises: [['Pull-ups', null, null]] },
      ],
    },
    {
      name: 'Full body B',
      blocks: [
        { method: 'Superset', exercises: [['Lunges', 10, 12], ['Table rows', 8, 10]] },
        { method: 'High-intensity set', exercises: [['Burpees', null, null]] },
      ],
    },
  ],
} as const;

const HISTORY_WEEKS = 3;

type SnapshotBlock = {
  training_method: { timing_family: string; stop_condition: string; rounds: number | null };
  exercises: { exercise_id: number; plan_block_exercise_id: number; reps_min: number | null }[];
};

async function insertPlan(client: PoolClient, userId: number) {
  const exerciseIds = new Map<string, number>();
  for (const ex of DEMO_EXERCISES) {
    const { rows } = await client.query<{ id: number }>(
      'INSERT INTO exercises (user_id, name, description) VALUES ($1, $2, $3) RETURNING id',
      [userId, ex.name, ex.description],
    );
    exerciseIds.set(ex.name, rows[0].id);
  }

  const methods = await client.query<{ id: number; name: string }>(
    'SELECT id, name FROM training_methods WHERE user_id = $1',
    [userId],
  );
  const methodIds = new Map(methods.rows.map((m) => [m.name, m.id]));

  const plan = await client.query<{ id: number }>('INSERT INTO plans (user_id, name) VALUES ($1, $2) RETURNING id', [
    userId,
    DEMO_PLAN.name,
  ]);
  const planId = plan.rows[0].id;

  const dayIds: number[] = [];
  for (const [dayIndex, day] of DEMO_PLAN.days.entries()) {
    const dayRow = await client.query<{ id: number }>(
      'INSERT INTO plan_days (plan_id, name, day_order) VALUES ($1, $2, $3) RETURNING id',
      [planId, day.name, dayIndex],
    );
    dayIds.push(dayRow.rows[0].id);
    for (const [blockIndex, block] of day.blocks.entries()) {
      const blockRow = await client.query<{ id: number }>(
        'INSERT INTO plan_blocks (plan_day_id, block_order, training_method_id) VALUES ($1, $2, $3) RETURNING id',
        [dayRow.rows[0].id, blockIndex, methodIds.get(block.method)],
      );
      for (const [exerciseIndex, [name, repsMin, repsMax]] of block.exercises.entries()) {
        await client.query(
          `INSERT INTO plan_block_exercises (plan_block_id, exercise_id, exercise_order, reps_min, reps_max)
           VALUES ($1, $2, $3, $4, $5)`,
          [blockRow.rows[0].id, exerciseIds.get(name), exerciseIndex, repsMin, repsMax],
        );
      }
    }
  }
  return { planId, dayIds };
}

// Sets per block matching the method, with slightly rising values per week (for progress/records).
function setsForBlock(block: SnapshotBlock, week: number) {
  const sets: { exercise_id: number; plan_block_exercise_id: number; unit_index: number; reps: number }[] = [];
  const method = block.training_method;
  for (const ex of block.exercises) {
    if (method.timing_family === 'self-paced') {
      // Ladder set: reps rise with each step, one more step per week.
      for (let stage = 0; stage < 3 + week; stage++) {
        sets.push({ exercise_id: ex.exercise_id, plan_block_exercise_id: ex.plan_block_exercise_id, unit_index: stage, reps: stage + 1 });
      }
    } else {
      const base = ex.reps_min ?? 6;
      for (let round = 0; round < (method.rounds ?? 3); round++) {
        sets.push({
          exercise_id: ex.exercise_id,
          plan_block_exercise_id: ex.plan_block_exercise_id,
          unit_index: round,
          reps: base + week - (round > 1 ? 1 : 0),
        });
      }
    }
  }
  return sets;
}

async function insertHistory(client: PoolClient, userId: number, planId: number, dayIds: number[]) {
  const snapshots = await Promise.all(dayIds.map((id) => buildDaySnapshot(id, client)));
  const now = Date.now();

  for (let week = 1; week <= HISTORY_WEEKS; week++) {
    const weekStart = now - (HISTORY_WEEKS + 1 - week) * 7 * DAY_MS;
    const weekRow = await client.query<{ id: number }>(
      `INSERT INTO plan_weeks (user_id, plan_id, week_number, started_at, ended_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, planId, week, new Date(weekStart), new Date(weekStart + 6 * DAY_MS)],
    );

    for (const [dayIndex, dayId] of dayIds.entries()) {
      const startedAt = weekStart + (1 + dayIndex * 2) * DAY_MS;
      const session = await client.query<{ id: number }>(
        `INSERT INTO training_sessions (plan_week_id, plan_day_id, day_snapshot, status, started_at, completed_at)
         VALUES ($1, $2, $3, 'completed', $4, $5) RETURNING id`,
        [weekRow.rows[0].id, dayId, JSON.stringify(snapshots[dayIndex]), new Date(startedAt), new Date(startedAt + 40 * 60 * 1000)],
      );

      const sets = (snapshots[dayIndex].blocks as SnapshotBlock[]).flatMap((block) => setsForBlock(block, week));
      for (const [i, set] of sets.entries()) {
        await client.query(
          `INSERT INTO logged_sets (training_session_id, exercise_id, plan_block_exercise_id, unit_index, reps, performed_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [session.rows[0].id, set.exercise_id, set.plan_block_exercise_id, set.unit_index, set.reps, new Date(startedAt + (i + 1) * 60 * 1000)],
        );
      }
    }
  }

  // Running week without sessions: a training can be started right away.
  await client.query(
    'INSERT INTO plan_weeks (user_id, plan_id, week_number, started_at) VALUES ($1, $2, $3, $4)',
    [userId, planId, HISTORY_WEEKS + 1, new Date(now - DAY_MS)],
  );
}

export async function createDemoUser(): Promise<AuthUser> {
  const username = `demo-${randomBytes(3).toString('hex')}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO users (name, username, password_hash, demo_expires_at)
       VALUES ($1, $1, $2, now() + $3 * interval '1 millisecond') RETURNING id`,
      [username, NO_LOGIN_HASH, DEMO_TTL_MS],
    );
    const userId = rows[0].id;
    await seedDefaultTrainingMethods(client, userId);
    const { planId, dayIds } = await insertPlan(client, userId);
    await insertHistory(client, userId, planId, dayIds);
    await client.query('COMMIT');
    return { id: userId, username };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteExpiredDemoUsers(): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    'SELECT id FROM users WHERE demo_expires_at IS NOT NULL AND demo_expires_at <= now()',
  );
  for (const { id } of rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await deleteUserWithData(client, id);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  return rows.length;
}

export function startDemoCleanup() {
  const run = () =>
    deleteExpiredDemoUsers()
      .then((count) => {
        if (count > 0) console.log(`demo: deleted ${count} expired demo users`);
      })
      .catch((err: Error) => console.error('demo: cleanup failed:', err.message));
  void run();
  setInterval(run, CLEANUP_INTERVAL_MS).unref();
}
