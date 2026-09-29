import express from 'express';
import { pool } from './db.js';
import { exercisesRouter } from './routes/exercises.js';
import { plansRouter } from './routes/plans.js';
import { planWeeksRouter } from './routes/plan-weeks.js';
import { sessionsRouter } from './routes/sessions.js';
import { trainingMethodsRouter } from './routes/training-methods.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/api/health', async (_req, res) => {
    try {
      const result = await pool.query('SELECT NOW() AS db_time');
      res.json({ status: 'ok', db_time: result.rows[0].db_time });
    } catch (err) {
      res.status(500).json({ status: 'error', message: (err as Error).message });
    }
  });

  app.use('/api/exercises', exercisesRouter);
  app.use('/api/plans', plansRouter);
  app.use('/api/plan-weeks', planWeeksRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/training-methods', trainingMethodsRouter);

  return app;
}
