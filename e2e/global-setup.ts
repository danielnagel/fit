import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { request, type FullConfig } from '@playwright/test';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(e2eDir);

export const E2E_USER = { username: 'e2e', password: 'e2e-password' };
export const STORAGE_STATE = path.join(e2eDir, '.auth', 'state.json');

export default async function globalSetup(config: FullConfig) {
  // Always start with a fresh DB: backend/vitest uses the same fit-db service
  // (see docker-compose.test.yml) and truncates its tables, so leftovers from those runs would
  // otherwise end up in the e2e run.
  execFileSync('docker', ['compose', '-f', 'docker-compose.test.yml', 'down', '-v'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  execFileSync('docker', ['compose', '-f', 'docker-compose.test.yml', 'up', '-d', '--build', '--wait'], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  // With seed, the specs use the default training methods (Intervallsatz etc.).
  execFileSync(
    'docker',
    [
      'compose', '-f', 'docker-compose.test.yml', 'exec', '-T', 'fit-backend',
      'npm', 'run', 'user:create', '--', E2E_USER.username, E2E_USER.password,
    ],
    { cwd: rootDir, stdio: 'inherit' },
  );

  // Log in once per run; the specs start with this cookie (storageState in playwright.config.ts).
  const context = await request.newContext({ baseURL: config.projects[0].use.baseURL });
  const res = await context.post('/api/auth/login', { data: E2E_USER });
  if (!res.ok()) throw new Error(`E2E login failed: ${res.status()} ${await res.text()}`);
  await context.storageState({ path: STORAGE_STATE });
  await context.dispose();
}
