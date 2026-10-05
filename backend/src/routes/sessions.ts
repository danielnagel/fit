import { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { pool } from '../db.js';
import { currentUser } from '../middleware/requireAuth.js';

export const sessionsRouter = Router();

// All /:id routes (incl. sub-resources) only for sessions of the logged-in user; foreign and
// unknown IDs both answer 404 so nobody learns which IDs exist.
sessionsRouter.param('id', async (req, res, next, id: string) => {
  const sessionId = Number(id);
  const result = Number.isInteger(sessionId)
    ? await pool.query(
        `SELECT 1 FROM training_sessions ts
         JOIN plan_weeks pw ON pw.id = ts.plan_week_id
         WHERE ts.id = $1 AND pw.user_id = $2`,
        [sessionId, currentUser(req).id],
      )
    : { rows: [] };
  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Session not found' });
    return;
  }
  next();
});

async function ownsExercise(userId: number, exerciseId: number) {
  const result = await pool.query('SELECT 1 FROM exercises WHERE id = $1 AND user_id = $2', [exerciseId, userId]);
  return result.rows.length > 0;
}

export async function buildDaySnapshot(planDayId: number, db: Pool | PoolClient = pool) {
  const dayResult = await db.query('SELECT name FROM plan_days WHERE id = $1', [planDayId]);
  const day = dayResult.rows[0];

  const blocksResult = await db.query(
    `SELECT pb.id, tm.name, tm.scope, tm.timing_family, tm.window_seconds, tm.work_seconds, tm.rest_seconds,
            tm.rest_formula, tm.rest_factor, tm.stop_condition, tm.rounds, tm.total_duration_seconds
     FROM plan_blocks pb
     JOIN training_methods tm ON tm.id = pb.training_method_id
     WHERE pb.plan_day_id = $1
     ORDER BY pb.block_order`,
    [planDayId],
  );

  const blocks = [];
  for (const block of blocksResult.rows) {
    const exercisesResult = await db.query(
      `SELECT pbe.id AS plan_block_exercise_id, pbe.exercise_id, pbe.reps_min, pbe.reps_max, pbe.note,
              pbe.is_unilateral_active, e.name AS exercise_name, e.description AS exercise_description
       FROM plan_block_exercises pbe
       JOIN exercises e ON e.id = pbe.exercise_id
       WHERE pbe.plan_block_id = $1
       ORDER BY pbe.exercise_order`,
      [block.id],
    );

    blocks.push({
      training_method: {
        name: block.name,
        scope: block.scope,
        timing_family: block.timing_family,
        window_seconds: block.window_seconds,
        work_seconds: block.work_seconds,
        rest_seconds: block.rest_seconds,
        rest_formula: block.rest_formula,
        rest_factor: block.rest_factor,
        stop_condition: block.stop_condition,
        rounds: block.rounds,
        total_duration_seconds: block.total_duration_seconds,
      },
      exercises: exercisesResult.rows.map((ex) => ({
        exercise_id: ex.exercise_id,
        plan_block_exercise_id: ex.plan_block_exercise_id,
        exercise_name: ex.exercise_name,
        description: ex.exercise_description,
        reps_min: ex.reps_min,
        reps_max: ex.reps_max,
        note: ex.note,
        is_unilateral_active: ex.is_unilateral_active,
      })),
    });
  }

  return { name: day.name, blocks };
}

async function loadPreviousLoggedSets(planDayId: number | null, sessionId: number) {
  if (planDayId === null) return [];

  const previousSessionResult = await pool.query<{ id: number }>(
    `SELECT id FROM training_sessions
     WHERE plan_day_id = $1 AND id != $2 AND status = 'completed'
     ORDER BY started_at DESC LIMIT 1`,
    [planDayId, sessionId],
  );
  if (previousSessionResult.rows.length === 0) return [];

  const previousLoggedResult = await pool.query(
    `SELECT exercise_id, unit_index, reps FROM logged_sets WHERE training_session_id = $1`,
    [previousSessionResult.rows[0].id],
  );
  return previousLoggedResult.rows;
}

// "Record" applies to exercises in self-paced blocks (previously hard-coded to type === 'ladder'):
// max(unit_index) = furthest step/round reached, max(reps) = most reps achieved there.
// As before without restricting to the same plan_day_id -- best performance across all self-paced
// sessions of this exercise, regardless of the specific plan/day.
async function loadStageRecords(exerciseIds: number[], sessionId: number, userId: number) {
  if (exerciseIds.length === 0) return [];

  const result = await pool.query<{ exercise_id: number; max_stage: number; best_reps: number | null }>(
    `SELECT ls.exercise_id, MAX(ls.unit_index) AS max_stage, MAX(ls.reps) AS best_reps
     FROM logged_sets ls
     JOIN training_sessions ts ON ts.id = ls.training_session_id
     JOIN plan_weeks pw ON pw.id = ts.plan_week_id
     WHERE ls.exercise_id = ANY($1) AND ts.id != $2 AND ts.status = 'completed' AND pw.user_id = $3
       AND EXISTS (
         SELECT 1
         FROM jsonb_array_elements(ts.day_snapshot->'blocks') AS blk
         CROSS JOIN LATERAL jsonb_array_elements(blk->'exercises') AS ex
         WHERE (blk->'training_method'->>'timing_family') = 'self-paced'
           AND (ex->>'exercise_id')::int = ls.exercise_id
       )
     GROUP BY ls.exercise_id`,
    [exerciseIds, sessionId, userId],
  );
  return result.rows;
}

async function loadSessionDetail(sessionId: number, userId: number) {
  const sessionResult = await pool.query(
    `SELECT ts.id, ts.plan_week_id, ts.plan_day_id, ts.day_snapshot, ts.status, ts.started_at, ts.completed_at
     FROM training_sessions ts
     JOIN plan_weeks pw ON pw.id = ts.plan_week_id
     WHERE ts.id = $1 AND pw.user_id = $2`,
    [sessionId, userId],
  );
  if (sessionResult.rows.length === 0) return null;
  const session = sessionResult.rows[0];

  const loggedSetsResult = await pool.query(
    `SELECT id, exercise_id, plan_block_exercise_id, unit_index, reps, completed_seconds, side, performed_at
     FROM logged_sets WHERE training_session_id = $1
     ORDER BY performed_at`,
    [sessionId],
  );
  const previousLoggedSets = await loadPreviousLoggedSets(session.plan_day_id, sessionId);
  const exerciseIds: number[] = (session.day_snapshot.blocks ?? []).flatMap((block: { exercises: { exercise_id: number }[] }) =>
    block.exercises.map((ex) => ex.exercise_id),
  );
  const records = await loadStageRecords(exerciseIds, sessionId, userId);

  const finishedExercisesResult = await pool.query<{ exercise_id: number; plan_block_exercise_id: number | null }>(
    `SELECT exercise_id, plan_block_exercise_id FROM session_finished_exercises WHERE training_session_id = $1`,
    [sessionId],
  );

  const timerAnchorsResult = await pool.query<{
    slot: 'primary' | 'secondary';
    phase_key: string;
    duration_seconds: number;
    started_at: string;
  }>(
    `SELECT slot, phase_key, duration_seconds, started_at FROM session_timer_anchors WHERE training_session_id = $1`,
    [sessionId],
  );
  const timerAnchors: Record<string, { phase_key: string; duration_seconds: number; started_at: string }> = {};
  for (const row of timerAnchorsResult.rows) {
    timerAnchors[row.slot] = { phase_key: row.phase_key, duration_seconds: row.duration_seconds, started_at: row.started_at };
  }

  return {
    ...session,
    logged_sets: loggedSetsResult.rows,
    previous_logged_sets: previousLoggedSets,
    records,
    finished_exercises: finishedExercisesResult.rows,
    timer_anchors: timerAnchors,
  };
}

sessionsRouter.get('/', async (req, res) => {
  const params: (string | number)[] = [currentUser(req).id];
  const conditions: string[] = ['pw.user_id = $1'];
  if (req.query.plan_week_id) {
    params.push(Number(req.query.plan_week_id));
    conditions.push(`ts.plan_week_id = $${params.length}`);
  }
  if (req.query.status) {
    params.push(String(req.query.status));
    conditions.push(`ts.status = $${params.length}`);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;

  const result = await pool.query(
    `SELECT ts.id, ts.plan_week_id, ts.plan_day_id, ts.day_snapshot, ts.status, ts.started_at, ts.completed_at,
            pw.started_at AS week_started_at, p.id AS plan_id, p.name AS plan_name
     FROM training_sessions ts
     JOIN plan_weeks pw ON pw.id = ts.plan_week_id
     JOIN plans p ON p.id = pw.plan_id
     ${where} ORDER BY ts.started_at DESC`,
    params,
  );
  res.json(result.rows);
});

sessionsRouter.get('/:id', async (req, res) => {
  const session = await loadSessionDetail(Number(req.params.id), currentUser(req).id);
  if (!session) {
    res.status(404).json({ message: 'Session not found' });
    return;
  }
  res.json(session);
});

sessionsRouter.post('/', async (req, res) => {
  const body = (req.body ?? {}) as { plan_day_id?: number };
  if (!Number.isInteger(body.plan_day_id)) {
    res.status(400).json({ message: 'plan_day_id is required' });
    return;
  }

  const userId = currentUser(req).id;
  const activeWeekResult = await pool.query<{ id: number; plan_id: number }>(
    'SELECT id, plan_id FROM plan_weeks WHERE user_id = $1 AND ended_at IS NULL',
    [userId],
  );
  if (activeWeekResult.rows.length === 0) {
    res.status(400).json({ message: 'No active week — start a week first' });
    return;
  }
  const activeWeek = activeWeekResult.rows[0];

  const dayCheck = await pool.query('SELECT id FROM plan_days WHERE id = $1 AND plan_id = $2', [
    body.plan_day_id,
    activeWeek.plan_id,
  ]);
  if (dayCheck.rows.length === 0) {
    res.status(400).json({ message: 'Training day does not belong to the plan of the active week' });
    return;
  }

  const snapshot = await buildDaySnapshot(body.plan_day_id!);
  const result = await pool.query<{ id: number }>(
    `INSERT INTO training_sessions (plan_week_id, plan_day_id, day_snapshot)
     VALUES ($1, $2, $3) RETURNING id`,
    [activeWeek.id, body.plan_day_id, JSON.stringify(snapshot)],
  );

  res.status(201).json(await loadSessionDetail(result.rows[0].id, userId));
});

sessionsRouter.patch('/:id', async (req, res) => {
  const { status } = (req.body ?? {}) as { status?: string };
  if (status !== 'in_progress' && status !== 'completed' && status !== 'aborted') {
    res.status(400).json({ message: 'invalid status' });
    return;
  }

  const result = await pool.query(
    `UPDATE training_sessions
     SET status = $1, completed_at = CASE WHEN $1 = 'in_progress' THEN NULL ELSE now() END
     WHERE id = $2`,
    [status, req.params.id],
  );
  if (result.rowCount === 0) {
    res.status(404).json({ message: 'Session not found' });
    return;
  }
  res.json(await loadSessionDetail(Number(req.params.id), currentUser(req).id));
});

sessionsRouter.post('/:id/logged-sets', async (req, res) => {
  const sessionId = Number(req.params.id);
  const { exercise_id, plan_block_exercise_id, unit_index, reps, completed_seconds, side } = (req.body ?? {}) as {
    exercise_id?: number;
    plan_block_exercise_id?: number | null;
    unit_index?: number;
    reps?: number | null;
    completed_seconds?: number | null;
    side?: 'left' | 'right' | null;
  };
  if (!Number.isInteger(exercise_id) || !Number.isInteger(unit_index)) {
    res.status(400).json({ message: 'exercise_id and unit_index are required' });
    return;
  }
  if (plan_block_exercise_id !== undefined && plan_block_exercise_id !== null && !Number.isInteger(plan_block_exercise_id)) {
    res.status(400).json({ message: 'plan_block_exercise_id must be a number or null' });
    return;
  }
  if (side !== undefined && side !== null && side !== 'left' && side !== 'right') {
    res.status(400).json({ message: 'side must be "left", "right" or null' });
    return;
  }
  if (!(await ownsExercise(currentUser(req).id, exercise_id!))) {
    res.status(400).json({ message: 'unknown exercise_id' });
    return;
  }

  const result = await pool.query(
    `INSERT INTO logged_sets (training_session_id, exercise_id, plan_block_exercise_id, unit_index, reps, completed_seconds, side)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, exercise_id, plan_block_exercise_id, unit_index, reps, completed_seconds, side, performed_at`,
    [sessionId, exercise_id, plan_block_exercise_id ?? null, unit_index, reps ?? null, completed_seconds ?? null, side ?? null],
  );
  res.status(201).json(result.rows[0]);
});

sessionsRouter.post('/:id/finished-exercises', async (req, res) => {
  const sessionId = Number(req.params.id);
  const { exercise_id, plan_block_exercise_id } = (req.body ?? {}) as {
    exercise_id?: number;
    plan_block_exercise_id?: number | null;
  };
  if (!Number.isInteger(exercise_id)) {
    res.status(400).json({ message: 'exercise_id is required' });
    return;
  }
  if (plan_block_exercise_id !== undefined && plan_block_exercise_id !== null && !Number.isInteger(plan_block_exercise_id)) {
    res.status(400).json({ message: 'plan_block_exercise_id must be a number or null' });
    return;
  }
  const userId = currentUser(req).id;
  if (!(await ownsExercise(userId, exercise_id!))) {
    res.status(400).json({ message: 'unknown exercise_id' });
    return;
  }

  // exercise_id alone doesn't reliably identify the plan slot -- the same exercise can appear several
  // times in the same block as a different variant. If plan_block_exercise_id is known, deduplicate
  // per slot, otherwise (old sessions frozen before this extension) per exercise_id as before --
  // see migration 0016 for the two matching partial unique indexes.
  if (plan_block_exercise_id != null) {
    await pool.query(
      `INSERT INTO session_finished_exercises (training_session_id, exercise_id, plan_block_exercise_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (training_session_id, plan_block_exercise_id) WHERE plan_block_exercise_id IS NOT NULL DO NOTHING`,
      [sessionId, exercise_id, plan_block_exercise_id],
    );
  } else {
    await pool.query(
      `INSERT INTO session_finished_exercises (training_session_id, exercise_id, plan_block_exercise_id)
       VALUES ($1, $2, NULL)
       ON CONFLICT (training_session_id, exercise_id) WHERE plan_block_exercise_id IS NULL DO NOTHING`,
      [sessionId, exercise_id],
    );
  }
  res.status(201).json(await loadSessionDetail(sessionId, userId));
});

sessionsRouter.put('/:id/timer-anchor/:slot', async (req, res) => {
  const sessionId = Number(req.params.id);
  const slot = req.params.slot;
  if (slot !== 'primary' && slot !== 'secondary') {
    res.status(400).json({ message: 'invalid slot' });
    return;
  }
  const { phase_key, duration_seconds } = (req.body ?? {}) as { phase_key?: string; duration_seconds?: number };
  if (typeof phase_key !== 'string' || !phase_key || !Number.isFinite(duration_seconds)) {
    res.status(400).json({ message: 'phase_key and duration_seconds are required' });
    return;
  }

  await pool.query(
    `INSERT INTO session_timer_anchors (training_session_id, slot, phase_key, duration_seconds, started_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (training_session_id, slot)
     DO UPDATE SET phase_key = $3, duration_seconds = $4, started_at = now()`,
    [sessionId, slot, phase_key, duration_seconds],
  );
  res.status(204).send();
});

sessionsRouter.delete('/:id', async (req, res) => {
  const result = await pool.query('DELETE FROM training_sessions WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) {
    res.status(404).json({ message: 'Session not found' });
    return;
  }
  res.status(204).send();
});

sessionsRouter.delete('/:id/logged-sets/:setId', async (req, res) => {
  const result = await pool.query('DELETE FROM logged_sets WHERE id = $1 AND training_session_id = $2', [
    req.params.setId,
    req.params.id,
  ]);
  if (result.rowCount === 0) {
    res.status(404).json({ message: 'Set not found' });
    return;
  }
  res.status(204).send();
});

sessionsRouter.patch('/:id/logged-sets/:setId', async (req, res) => {
  const { reps, side } = (req.body ?? {}) as { reps?: number | null; side?: 'left' | 'right' | null };
  if (side !== undefined && side !== null && side !== 'left' && side !== 'right') {
    res.status(400).json({ message: 'side must be "left", "right" or null' });
    return;
  }

  const result = await pool.query(
    `UPDATE logged_sets SET reps = $1, side = COALESCE($2, side) WHERE id = $3 AND training_session_id = $4
     RETURNING id, exercise_id, plan_block_exercise_id, unit_index, reps, completed_seconds, side, performed_at`,
    [reps ?? null, side ?? null, req.params.setId, req.params.id],
  );
  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Set not found' });
    return;
  }
  res.json(result.rows[0]);
});
