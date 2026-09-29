import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export default function globalSetup() {
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
}
