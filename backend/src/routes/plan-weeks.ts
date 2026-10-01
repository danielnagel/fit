import { Router } from 'express';
import { pool } from '../db.js';
import { currentUser } from '../middleware/requireAuth.js';

export const planWeeksRouter = Router();

async function loadActiveWeek(userId: number) {
  const weekResult = await pool.query(
    `SELECT pw.id, pw.plan_id, p.name AS plan_name, pw.week_number, pw.started_at
     FROM plan_weeks pw
     JOIN plans p ON p.id = pw.plan_id
     WHERE pw.user_id = $1 AND pw.ended_at IS NULL`,
    [userId],
  );
  if (weekResult.rows.length === 0) return null;

  const week = weekResult.rows[0];
  const sessionsResult = await pool.query(
    'SELECT id, plan_day_id, status FROM training_sessions WHERE plan_week_id = $1',
    [week.id],
  );

  return { ...week, sessions: sessionsResult.rows };
}

planWeeksRouter.get('/active', async (req, res) => {
  const week = await loadActiveWeek(currentUser(req).id);
  res.json(week);
});

planWeeksRouter.post('/', async (req, res) => {
  const { plan_id: planId } = (req.body ?? {}) as { plan_id?: number };
  if (!Number.isInteger(planId)) {
    res.status(400).json({ message: 'plan_id ist erforderlich' });
    return;
  }

  const userId = currentUser(req).id;
  const planResult = await pool.query('SELECT 1 FROM plans WHERE id = $1 AND user_id = $2', [planId, userId]);
  if (planResult.rows.length === 0) {
    res.status(404).json({ message: 'Plan nicht gefunden' });
    return;
  }

  try {
    const weekNumberResult = await pool.query<{ next: number }>(
      'SELECT COALESCE(MAX(week_number), 0) + 1 AS next FROM plan_weeks WHERE plan_id = $1',
      [planId],
    );
    const weekNumber = weekNumberResult.rows[0].next;

    await pool.query('INSERT INTO plan_weeks (user_id, plan_id, week_number) VALUES ($1, $2, $3)', [
      userId,
      planId,
      weekNumber,
    ]);
    res.status(201).json(await loadActiveWeek(userId));
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ message: 'Es läuft bereits eine Woche — erst beenden' });
      return;
    }
    res.status(500).json({ message: (err as Error).message });
  }
});

planWeeksRouter.patch('/:id', async (req, res) => {
  const weekId = Number(req.params.id);
  const userId = currentUser(req).id;

  const inProgressResult = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM training_sessions ts
     JOIN plan_weeks pw ON pw.id = ts.plan_week_id
     WHERE ts.plan_week_id = $1 AND pw.user_id = $2 AND ts.status = 'in_progress'`,
    [weekId, userId],
  );
  if (inProgressResult.rows[0].count > 0) {
    res.status(409).json({ message: 'Es gibt noch ein laufendes Training in dieser Woche' });
    return;
  }

  const result = await pool.query(
    'UPDATE plan_weeks SET ended_at = now() WHERE id = $1 AND user_id = $2 AND ended_at IS NULL',
    [weekId, userId],
  );
  if (result.rowCount === 0) {
    res.status(404).json({ message: 'Aktive Woche nicht gefunden' });
    return;
  }
  res.status(204).send();
});
