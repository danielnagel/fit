import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { request, type FullConfig } from '@playwright/test';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(e2eDir);

export const E2E_USER = { username: 'e2e', password: 'e2e-password' };
export const STORAGE_STATE = path.join(e2eDir, '.auth', 'state.json');

export default async function globalSetup(config: FullConfig) {
  // Immer mit einer frischen DB starten: backend/vitest nutzt denselben fit-db-Service
  // (siehe docker-compose.test.yml) und truncatet dabei u.a. training_methods, wodurch die
  // per Migration geseedeten Katalog-Methoden (Intervallsatz etc.) sonst dauerhaft fehlen wuerden.
  execFileSync('docker', ['compose', '-f', 'docker-compose.test.yml', 'down', '-v'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  execFileSync('docker', ['compose', '-f', 'docker-compose.test.yml', 'up', '-d', '--build', '--wait'], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  // Mit Seed, die Specs nutzen die Standard-Trainingsmethoden (Intervallsatz etc.).
  execFileSync(
    'docker',
    [
      'compose', '-f', 'docker-compose.test.yml', 'exec', '-T', 'fit-backend',
      'npm', 'run', 'user:create', '--', E2E_USER.username, E2E_USER.password,
    ],
    { cwd: rootDir, stdio: 'inherit' },
  );

  // Einmal pro Lauf einloggen; die Specs starten mit diesem Cookie (storageState in playwright.config.ts).
  const context = await request.newContext({ baseURL: config.projects[0].use.baseURL });
  const res = await context.post('/api/auth/login', { data: E2E_USER });
  if (!res.ok()) throw new Error(`E2E-Login fehlgeschlagen: ${res.status()} ${await res.text()}`);
  await context.storageState({ path: STORAGE_STATE });
  await context.dispose();
}
