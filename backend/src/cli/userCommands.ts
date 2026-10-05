import type { PoolClient } from 'pg';
import { pool } from '../db.js';
import { hashPassword } from '../auth/password.js';
import { seedDefaultTrainingMethods } from '../defaultTrainingMethods.js';
import { deleteUserWithData } from '../users.js';

// Input/output as a parameter so the commands can run in tests without a terminal.
export interface CliIo {
  out(line: string): void;
  err(line: string): void;
  isTTY: boolean;
  prompt(question: string): Promise<string>;
  promptHidden(question: string): Promise<string>;
}

export const MIN_PASSWORD_LENGTH = 8;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

interface UserRow {
  id: number;
  name: string;
  username: string | null;
}

function label(user: UserRow) {
  return user.username ?? `${user.name} (id ${user.id}, no login)`;
}

// Accepts a numeric id, a username or -- for the legacy default user, which has no
// username -- its name.
async function findUser(client: PoolClient | typeof pool, ref: string): Promise<UserRow | null> {
  const id = /^[0-9]+$/.test(ref) ? Number(ref) : null;
  const { rows } = await client.query<UserRow>(
    `SELECT id, name, username FROM users
     WHERE username = $1 OR id = $2 OR (username IS NULL AND name = $1)
     ORDER BY CASE WHEN username = $1 THEN 0 WHEN id = $2 THEN 1 ELSE 2 END
     LIMIT 1`,
    [ref, id],
  );
  return rows[0] ?? null;
}

async function readNewPassword(io: CliIo, given: string | undefined): Promise<string | null> {
  if (given !== undefined) return given;
  if (!io.isTTY) {
    io.err('No password given and interactive input is not possible (stdin is not a terminal).');
    return null;
  }
  const password = await io.promptHidden('Password: ');
  const repeated = await io.promptHidden('Repeat password: ');
  if (password !== repeated) {
    io.err('The passwords do not match.');
    return null;
  }
  return password;
}

function passwordError(password: string) {
  return password.length < MIN_PASSWORD_LENGTH ? `The password must be at least ${MIN_PASSWORD_LENGTH} characters long.` : null;
}

export async function createUser(io: CliIo, args: { username?: string; password?: string; seed: boolean }) {
  let username = args.username;
  if (username === undefined) {
    if (!io.isTTY) {
      io.err('Usage: npm run user:create -- <username> <password> [--no-seed]');
      io.err('Without arguments you are prompted interactively; stdin has to be a terminal for that.');
      return 1;
    }
    username = (await io.prompt('Username: ')).trim();
  }
  if (!USERNAME_PATTERN.test(username)) {
    io.err('Invalid username (allowed: letters, digits, ".", "_", "-"; max. 64 characters).');
    return 1;
  }
  if (await findUser(pool, username)) {
    io.err(`A user "${username}" already exists.`);
    return 1;
  }

  const password = await readNewPassword(io, args.password);
  if (password === null) return 1;
  const error = passwordError(password);
  if (error) {
    io.err(error);
    return 1;
  }

  const passwordHash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id: number }>(
      'INSERT INTO users (name, username, password_hash) VALUES ($1, $1, $2) RETURNING id',
      [username, passwordHash],
    );
    if (args.seed) await seedDefaultTrainingMethods(client, rows[0].id);
    await client.query('COMMIT');
    io.out(`User created: ${username} (id ${rows[0].id})${args.seed ? ', default training methods created' : ''}`);
    return 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listUsers(io: CliIo) {
  const { rows } = await pool.query<
    UserRow & { created_at: Date; last_login_at: Date | null; plans: number; exercises: number; sessions: number }
  >(
    `SELECT u.id, u.name, u.username, u.created_at, u.last_login_at,
            (SELECT count(*)::int FROM plans p WHERE p.user_id = u.id) AS plans,
            (SELECT count(*)::int FROM exercises e WHERE e.user_id = u.id) AS exercises,
            (SELECT count(*)::int FROM training_sessions ts JOIN plan_weeks pw ON pw.id = ts.plan_week_id
              WHERE pw.user_id = u.id) AS sessions
     FROM users u
     ORDER BY u.id`,
  );

  for (const u of rows) {
    const lastLogin = u.last_login_at ? u.last_login_at.toISOString() : 'never';
    io.out(
      `${u.username ?? `${u.name} (no login)`}  (id ${u.id}, created ${u.created_at.toISOString()}, last login ${lastLogin}; ` +
        `${u.plans} plans, ${u.exercises} exercises, ${u.sessions} sessions)`,
    );
  }
  return 0;
}

export async function setPassword(io: CliIo, args: { username?: string; password?: string }) {
  if (!args.username) {
    io.err('Usage: npm run user:set-password -- <username> [<password>]');
    return 1;
  }
  const user = await findUser(pool, args.username);
  if (!user || !user.username) {
    io.err(`Unknown user "${args.username}" (the default user cannot get a password).`);
    return 1;
  }

  const password = await readNewPassword(io, args.password);
  if (password === null) return 1;
  const error = passwordError(password);
  if (error) {
    io.err(error);
    return 1;
  }

  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(password), user.id]);
  io.out(`Password set for ${user.username}.`);
  return 0;
}

export async function deleteUser(io: CliIo, args: { ref?: string; yes: boolean }) {
  if (!args.ref) {
    io.err('Usage: npm run user:delete -- <username|id> [--yes]');
    return 1;
  }
  const user = await findUser(pool, args.ref);
  if (!user) {
    io.err(`Unknown user "${args.ref}".`);
    return 1;
  }

  if (!args.yes) {
    if (!io.isTTY) {
      io.err('Deleting without a terminal requires --yes.');
      return 1;
    }
    const answer = await io.prompt(`Delete ${label(user)} and ALL associated data? (yes/no) `);
    if (answer.trim().toLowerCase() !== 'yes') {
      io.out('Aborted.');
      return 1;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await deleteUserWithData(client, user.id);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  io.out(`User ${label(user)} deleted.`);
  return 0;
}

const OWNED_TABLES = ['plans', 'exercises', 'training_methods', 'plan_weeks'] as const;

export async function assignData(io: CliIo, args: { from?: string; to?: string }) {
  if (!args.from || !args.to) {
    io.err('Usage: npm run user:assign-data -- --from <username|id> --to <username>');
    return 1;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const from = await findUser(client, args.from);
    const to = await findUser(client, args.to);
    if (!from || !to) {
      io.err(`Unknown user "${!from ? args.from : args.to}".`);
      await client.query('ROLLBACK');
      return 1;
    }
    if (from.id === to.id) {
      io.err('Source and target are the same user.');
      await client.query('ROLLBACK');
      return 1;
    }
    // Lock both users so no data gets added in parallel that the conflict check would miss.
    await client.query('SELECT 1 FROM users WHERE id = ANY($1) FOR UPDATE', [[from.id, to.id]]);

    const conflicts: string[] = [];
    const activeWeeks = await client.query(
      'SELECT user_id FROM plan_weeks WHERE user_id = ANY($1) AND ended_at IS NULL',
      [[from.id, to.id]],
    );
    if (activeWeeks.rows.length > 1) {
      conflicts.push('Both users have an active week (only one per user is allowed).');
    }
    const duplicateNames = await client.query<{ name: string }>(
      `SELECT name FROM exercises WHERE user_id = $1
       INTERSECT
       SELECT name FROM exercises WHERE user_id = $2
       ORDER BY name`,
      [from.id, to.id],
    );
    for (const { name } of duplicateNames.rows) {
      conflicts.push(`Exercise "${name}" exists for both users.`);
    }
    if (conflicts.length > 0) {
      io.err(`Aborted, nothing was moved. Conflicts:`);
      for (const conflict of conflicts) io.err(`  - ${conflict}`);
      await client.query('ROLLBACK');
      return 1;
    }

    const moved: Record<string, number> = {};
    for (const table of OWNED_TABLES) {
      const result = await client.query(`UPDATE ${table} SET user_id = $1 WHERE user_id = $2`, [to.id, from.id]);
      moved[table] = result.rowCount ?? 0;
    }
    await client.query('COMMIT');

    io.out(`Moved data from ${label(from)} to ${label(to)}:`);
    for (const table of OWNED_TABLES) io.out(`  ${table}: ${moved[table]}`);
    return 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
