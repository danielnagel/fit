import { pool } from '../src/db.js';

const APP_TABLES = [
  'exercises',
  'plans',
  'plan_days',
  'training_methods',
  'plan_blocks',
  'plan_block_exercises',
  'plan_weeks',
  'training_sessions',
  'logged_sets',
  'session_finished_exercises',
  'session_timer_anchors',
];

export async function resetDb() {
  await pool.query(`TRUNCATE ${APP_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}
