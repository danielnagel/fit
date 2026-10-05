import { pool } from './db.js';
import { runMigrations } from './migrate.js';
import { createApp } from './app.js';
import { isDemoMode, startDemoCleanup } from './demo.js';

const port = Number(process.env.PORT ?? 3000);

async function main() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set (generate one e.g. via `openssl rand -hex 32`)');
  }
  await runMigrations(pool);
  if (isDemoMode()) startDemoCleanup();
  const app = createApp();
  app.listen(port, () => {
    console.log(`fit-backend listening on port ${port}`);
  });
}

main().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
