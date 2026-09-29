import { beforeAll, beforeEach } from 'vitest';
import { pool } from '../src/db.js';
import { runMigrations } from '../src/migrate.js';
import { resetDb } from './db.js';

beforeAll(async () => {
  await runMigrations(pool);
});

beforeEach(async () => {
  await resetDb();
});
