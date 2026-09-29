import { pool } from './db.js';
import { runMigrations } from './migrate.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);

async function main() {
  await runMigrations(pool);
  const app = createApp();
  app.listen(port, () => {
    console.log(`fit-backend listening on port ${port}`);
  });
}

main().catch((err) => {
  console.error('Startup fehlgeschlagen:', err);
  process.exit(1);
});
