import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export default function globalTeardown() {
  execFileSync('docker', ['compose', '-f', 'docker-compose.test.yml', 'down', '-v'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
}
