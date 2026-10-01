import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      PGHOST: 'localhost',
      PGPORT: '5433',
      PGUSER: 'fit_test',
      PGPASSWORD: 'fit_test',
      PGDATABASE: 'fit_test',
      JWT_SECRET: 'test-secret',
    },
    setupFiles: ['./test/setup.ts'],
    isolate: false,
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
