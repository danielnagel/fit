#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(rootDir);
process.loadEnvFile('.env');

console.log('-> Checking/starting the database (fit-db)...');
execFileSync('docker', ['compose', 'up', '-d', '--wait', 'fit-db'], { stdio: 'inherit' });

// Backend/frontend run on the host here, not in the Docker network -> different
// connection settings than in docker compose mode (where the DB host is called "fit-db").
process.env.PGHOST = 'localhost';
process.env.PGPORT = '5432';
process.env.PGUSER = process.env.POSTGRES_USER;
process.env.PGPASSWORD = process.env.POSTGRES_PASSWORD;
process.env.PGDATABASE = process.env.POSTGRES_DB;
process.env.PORT ??= '3000';
process.env.VITE_BACKEND_URL = `http://localhost:${process.env.PORT}`;

console.log('-> Starting backend & frontend locally (hot reload)...');
execFileSync(
  'npx',
  [
    'concurrently',
    '-n', 'backend,frontend',
    '-c', 'blue,green',
    'npm run dev --workspace=backend',
    'npm run dev --workspace=frontend',
  ],
  { stdio: 'inherit' },
);
