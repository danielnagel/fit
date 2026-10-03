import type { PoolClient } from 'pg';
import { pool } from '../db.js';
import { hashPassword } from '../auth/password.js';
import { seedDefaultTrainingMethods } from '../defaultTrainingMethods.js';
import { deleteUserWithData } from '../users.js';

// Ein-/Ausgabe als Parameter, damit die Befehle in Tests ohne Terminal laufen.
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
  return user.username ?? `${user.name} (id ${user.id}, ohne Login)`;
}

// Akzeptiert eine numerische id, einen Benutzernamen oder -- fuer den Legacy-Default-User, der keinen
// username hat -- dessen name.
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
    io.err('Kein Passwort angegeben und keine interaktive Eingabe moeglich (stdin ist kein Terminal).');
    return null;
  }
  const password = await io.promptHidden('Passwort: ');
  const repeated = await io.promptHidden('Passwort wiederholen: ');
  if (password !== repeated) {
    io.err('Die Passwoerter stimmen nicht ueberein.');
    return null;
  }
  return password;
}

function passwordError(password: string) {
  return password.length < MIN_PASSWORD_LENGTH ? `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.` : null;
}

export async function createUser(io: CliIo, args: { username?: string; password?: string; seed: boolean }) {
  let username = args.username;
  if (username === undefined) {
    if (!io.isTTY) {
      io.err('Aufruf: npm run user:create -- <username> <password> [--no-seed]');
      io.err('Ohne Argumente wird interaktiv gefragt; dafuer muss stdin ein Terminal sein.');
      return 1;
    }
    username = (await io.prompt('Benutzername: ')).trim();
  }
  if (!USERNAME_PATTERN.test(username)) {
    io.err('Ungueltiger Benutzername (erlaubt: Buchstaben, Ziffern, ".", "_", "-"; max. 64 Zeichen).');
    return 1;
  }
  if (await findUser(pool, username)) {
    io.err(`Es gibt bereits einen Benutzer "${username}".`);
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
    io.out(`Benutzer angelegt: ${username} (id ${rows[0].id})${args.seed ? ', Standard-Trainingsmethoden angelegt' : ''}`);
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
    const lastLogin = u.last_login_at ? u.last_login_at.toISOString() : 'nie';
    io.out(
      `${u.username ?? `${u.name} (ohne Login)`}  (id ${u.id}, angelegt ${u.created_at.toISOString()}, letzter Login ${lastLogin}; ` +
        `${u.plans} Plaene, ${u.exercises} Uebungen, ${u.sessions} Sessions)`,
    );
  }
  return 0;
}

export async function setPassword(io: CliIo, args: { username?: string; password?: string }) {
  if (!args.username) {
    io.err('Aufruf: npm run user:set-password -- <username> [<password>]');
    return 1;
  }
  const user = await findUser(pool, args.username);
  if (!user || !user.username) {
    io.err(`Unbekannter Benutzer "${args.username}" (der Default-User kann kein Passwort bekommen).`);
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
  io.out(`Passwort fuer ${user.username} gesetzt.`);
  return 0;
}

export async function deleteUser(io: CliIo, args: { ref?: string; yes: boolean }) {
  if (!args.ref) {
    io.err('Aufruf: npm run user:delete -- <username|id> [--yes]');
    return 1;
  }
  const user = await findUser(pool, args.ref);
  if (!user) {
    io.err(`Unbekannter Benutzer "${args.ref}".`);
    return 1;
  }

  if (!args.yes) {
    if (!io.isTTY) {
      io.err('Loeschen ohne Terminal nur mit --yes.');
      return 1;
    }
    const answer = await io.prompt(`${label(user)} und ALLE zugehoerigen Daten loeschen? (ja/nein) `);
    if (answer.trim().toLowerCase() !== 'ja') {
      io.out('Abgebrochen.');
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
  io.out(`Benutzer ${label(user)} geloescht.`);
  return 0;
}

const OWNED_TABLES = ['plans', 'exercises', 'training_methods', 'plan_weeks'] as const;

export async function assignData(io: CliIo, args: { from?: string; to?: string }) {
  if (!args.from || !args.to) {
    io.err('Aufruf: npm run user:assign-data -- --from <username|id> --to <username>');
    return 1;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const from = await findUser(client, args.from);
    const to = await findUser(client, args.to);
    if (!from || !to) {
      io.err(`Unbekannter Benutzer "${!from ? args.from : args.to}".`);
      await client.query('ROLLBACK');
      return 1;
    }
    if (from.id === to.id) {
      io.err('Quelle und Ziel sind derselbe Benutzer.');
      await client.query('ROLLBACK');
      return 1;
    }
    // Beide Benutzer sperren, damit parallel keine Daten dazukommen, die die Konfliktpruefung verpasst.
    await client.query('SELECT 1 FROM users WHERE id = ANY($1) FOR UPDATE', [[from.id, to.id]]);

    const conflicts: string[] = [];
    const activeWeeks = await client.query(
      'SELECT user_id FROM plan_weeks WHERE user_id = ANY($1) AND ended_at IS NULL',
      [[from.id, to.id]],
    );
    if (activeWeeks.rows.length > 1) {
      conflicts.push('Beide Benutzer haben eine aktive Woche (pro Benutzer ist nur eine erlaubt).');
    }
    const duplicateNames = await client.query<{ name: string }>(
      `SELECT name FROM exercises WHERE user_id = $1
       INTERSECT
       SELECT name FROM exercises WHERE user_id = $2
       ORDER BY name`,
      [from.id, to.id],
    );
    for (const { name } of duplicateNames.rows) {
      conflicts.push(`Uebung "${name}" existiert bei beiden Benutzern.`);
    }
    if (conflicts.length > 0) {
      io.err(`Abgebrochen, nichts wurde uebertragen. Konflikte:`);
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

    io.out(`Daten von ${label(from)} auf ${label(to)} uebertragen:`);
    for (const table of OWNED_TABLES) io.out(`  ${table}: ${moved[table]}`);
    return 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
