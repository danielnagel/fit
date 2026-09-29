#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(rootDir);
process.loadEnvFile('.env');

console.log('-> Datenbank pruefen/starten (fit-db)...');
execFileSync('docker', ['compose', 'up', '-d', '--wait', 'fit-db'], { stdio: 'inherit' });

// Backend/Frontend laufen hier auf dem Host, nicht im Docker-Netzwerk -> andere
// Verbindungsdaten als im docker-compose-Modus (dort heisst der DB-Host "fit-db").
process.env.PGHOST = 'localhost';
process.env.PGPORT = '5432';
process.env.PGUSER = process.env.POSTGRES_USER;
process.env.PGPASSWORD = process.env.POSTGRES_PASSWORD;
process.env.PGDATABASE = process.env.POSTGRES_DB;
process.env.PORT ??= '3000';
process.env.VITE_BACKEND_URL = `http://localhost:${process.env.PORT}`;

console.log('-> Backend & Frontend lokal starten (Hot Reload)...');
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
