import { Router } from 'express';
import { pool } from '../db.js';
import { currentUser } from '../middleware/requireAuth.js';

export const exercisesRouter = Router();

exercisesRouter.get('/', async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, description, is_unilateral, created_at FROM exercises WHERE user_id = $1 ORDER BY name',
    [currentUser(req).id],
  );
  res.json(result.rows);
});

exercisesRouter.get('/:id/progress', async (req, res) => {
  const result = await pool.query(
    `SELECT ls.training_session_id, MIN(ls.performed_at) AS performed_at,
            MAX(ls.reps) AS max_reps, SUM(ls.reps)::int AS total_reps, COUNT(*)::int AS set_count
     FROM logged_sets ls
     JOIN training_sessions ts ON ts.id = ls.training_session_id
     JOIN plan_weeks pw ON pw.id = ts.plan_week_id
     WHERE ls.exercise_id = $1 AND ts.status = 'completed' AND pw.user_id = $2
     GROUP BY ls.training_session_id
     ORDER BY performed_at`,
    [req.params.id, currentUser(req).id],
  );
  res.json(result.rows);
});

exercisesRouter.post('/', async (req, res) => {
  const { name, description, is_unilateral } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ message: 'name ist erforderlich' });
    return;
  }

  try {
    const result = await pool.query(
      'INSERT INTO exercises (user_id, name, description, is_unilateral) VALUES ($1, $2, $3, $4) RETURNING id, name, description, is_unilateral, created_at',
      [currentUser(req).id, name.trim(), description || null, Boolean(is_unilateral)],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ message: 'Übung existiert bereits' });
      return;
    }
    res.status(500).json({ message: (err as Error).message });
  }
});

exercisesRouter.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, description, is_unilateral } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ message: 'name ist erforderlich' });
    return;
  }

  try {
    const result = await pool.query(
      'UPDATE exercises SET name = $1, description = $2, is_unilateral = $3 WHERE id = $4 AND user_id = $5 RETURNING id, name, description, is_unilateral, created_at',
      [name.trim(), description || null, Boolean(is_unilateral), id, currentUser(req).id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Übung nicht gefunden' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ message: 'Übung existiert bereits' });
      return;
    }
    res.status(500).json({ message: (err as Error).message });
  }
});

exercisesRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);

  try {
    const result = await pool.query('DELETE FROM exercises WHERE id = $1 AND user_id = $2', [id, currentUser(req).id]);
    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Übung nicht gefunden' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    if ((err as { code?: string }).code === '23503') {
      res.status(409).json({ message: 'Übung wird noch in einem Trainingsplan verwendet' });
      return;
    }
    res.status(500).json({ message: (err as Error).message });
  }
});
