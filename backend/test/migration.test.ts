import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { runMigrations } from '../src/migrate.js';

// Eigenes Schema statt der gemeinsamen Test-DB, die das globale Setup bereits voll migriert hat.
const SCHEMA = 'migration_test';

const adminPool = new pg.Pool();
const pool = new pg.Pool({ options: `-c search_path=${SCHEMA}` });

beforeAll(async () => {
  await adminPool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await adminPool.query(`CREATE SCHEMA ${SCHEMA}`);
  await runMigrations(pool, { upTo: '0016_session_finished_exercise_slot.sql' });

  // Bestand vor 0017: ein Plan mit aktiver Woche, Session und geloggtem Satz (frisches Schema, IDs ab 1).
  await pool.query(`
    INSERT INTO exercises (name) VALUES ('Kniebeuge'), ('Liegestuetz');
    INSERT INTO plans (name) VALUES ('Ganzkoerper');
    INSERT INTO plan_days (plan_id, name, day_order) VALUES (1, 'Tag A', 0);
    INSERT INTO plan_blocks (plan_day_id, block_order, training_method_id) VALUES (1, 0, 1);
    INSERT INTO plan_block_exercises (plan_block_id, exercise_id, exercise_order) VALUES (1, 1, 0);
    INSERT INTO plan_weeks (plan_id, week_number) VALUES (1, 1);
    INSERT INTO training_sessions (plan_week_id, plan_day_id, day_snapshot) VALUES (1, 1, '{}');
    INSERT INTO logged_sets (training_session_id, exercise_id, unit_index, reps) VALUES (1, 1, 0, 10);
  `);

  await runMigrations(pool);
});

afterAll(async () => {
  await pool.end();
  await adminPool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await adminPool.end();
});

describe('migration 0017_auth_and_ownership', () => {
  it('assigns all existing root rows to the default user', async () => {
    const { rows } = await pool.query(`
      SELECT
        (SELECT array_agg(DISTINCT user_id) FROM plans) AS plans,
        (SELECT array_agg(DISTINCT user_id) FROM exercises) AS exercises,
        (SELECT array_agg(DISTINCT user_id) FROM training_methods) AS training_methods,
        (SELECT array_agg(DISTINCT user_id) FROM plan_weeks) AS plan_weeks
    `);

    expect(rows[0]).toEqual({ plans: [1], exercises: [1], training_methods: [1], plan_weeks: [1] });
  });

  it('keeps child rows untouched', async () => {
    const { rows } = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM training_methods) AS training_methods,
        (SELECT count(*)::int FROM training_sessions) AS sessions,
        (SELECT count(*)::int FROM logged_sets) AS sets
    `);

    expect(rows[0]).toEqual({ training_methods: 5, sessions: 1, sets: 1 });
  });

  it('leaves the default user without credentials', async () => {
    const { rows } = await pool.query('SELECT name, username, password_hash FROM users');

    expect(rows).toEqual([{ name: 'Default', username: null, password_hash: null }]);
  });

  it('rejects a user with only a username or only a password hash', async () => {
    await expect(pool.query("INSERT INTO users (name, username) VALUES ('x', 'x')")).rejects.toThrow(
      /users_login_complete/,
    );
    await expect(pool.query("INSERT INTO users (name, password_hash) VALUES ('x', 'h')")).rejects.toThrow(
      /users_login_complete/,
    );
  });

  it('makes exercise names and the active week unique per user instead of globally', async () => {
    const { rows } = await pool.query(
      "INSERT INTO users (name, username, password_hash) VALUES ('b', 'b', 'h') RETURNING id",
    );
    const userB = rows[0].id;

    await pool.query('INSERT INTO exercises (user_id, name) VALUES ($1, $2)', [userB, 'Kniebeuge']);
    await expect(pool.query("INSERT INTO exercises (user_id, name) VALUES (1, 'Kniebeuge')")).rejects.toThrow(
      /exercises_user_name_idx/,
    );

    const plan = await pool.query("INSERT INTO plans (user_id, name) VALUES ($1, 'Plan B') RETURNING id", [userB]);
    await pool.query('INSERT INTO plan_weeks (user_id, plan_id, week_number) VALUES ($1, $2, 1)', [
      userB,
      plan.rows[0].id,
    ]);
    await expect(
      pool.query('INSERT INTO plan_weeks (user_id, plan_id, week_number) VALUES ($1, $2, 2)', [userB, plan.rows[0].id]),
    ).rejects.toThrow(/plan_weeks_single_active_idx/);
  });

  it('requires an owner for new plans', async () => {
    await expect(pool.query("INSERT INTO plans (name) VALUES ('ohne Besitzer')")).rejects.toThrow(/user_id/);
  });
});
