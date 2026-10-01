import express from 'express';
import cookieParser from 'cookie-parser';
import { pool } from './db.js';
import { requireAuth } from './middleware/requireAuth.js';
import { authRouter } from './routes/auth.js';
import { exercisesRouter } from './routes/exercises.js';
import { plansRouter } from './routes/plans.js';
import { planWeeksRouter } from './routes/plan-weeks.js';
import { sessionsRouter } from './routes/sessions.js';
import { trainingMethodsRouter } from './routes/training-methods.js';

export function createApp() {
  const app = express();

  // Anzahl Reverse-Proxies vor dem Backend (0 = direkt erreichbar). Bestimmt, wie viele Eintraege
  // aus X-Forwarded-For fuer req.ip vertraut werden; ohne korrekten Wert teilen sich alle Clients
  // hinter dem Proxy einen Rate-Limit-Bucket, mit zu hohem Wert laesst sich der Header faelschen.
  app.set('trust proxy', Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '0', 10));

  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    try {
      const result = await pool.query('SELECT NOW() AS db_time');
      res.json({ status: 'ok', db_time: result.rows[0].db_time });
    } catch (err) {
      res.status(500).json({ status: 'error', message: (err as Error).message });
    }
  });

  app.use('/api/auth', authRouter);

  app.use('/api/exercises', requireAuth, exercisesRouter);
  app.use('/api/plans', requireAuth, plansRouter);
  app.use('/api/plan-weeks', requireAuth, planWeeksRouter);
  app.use('/api/sessions', requireAuth, sessionsRouter);
  app.use('/api/training-methods', requireAuth, trainingMethodsRouter);

  return app;
}
