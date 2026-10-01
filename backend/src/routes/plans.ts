import { Router } from 'express';
import type { PoolClient } from 'pg';
import { pool } from '../db.js';
import { currentUser } from '../middleware/requireAuth.js';

export const plansRouter = Router();

type Scope = 'single' | 'pair' | 'all';

function exerciseCountError(scope: Scope, count: number): string | null {
  if (scope === 'pair') {
    if (count < 2 || count % 2 !== 0) return 'Diese Methode benötigt eine gerade Anzahl Übungen (mind. 2, als Paare)';
    return null;
  }
  if (count < 1) return 'Jeder Block benötigt mindestens eine Übung';
  return null;
}

type ExerciseInput = {
  exercise_id?: number;
  reps_min?: number | null;
  reps_max?: number | null;
  note?: string | null;
  is_unilateral_active?: boolean;
};
type BlockInput = {
  training_method_id?: number;
  exercises?: ExerciseInput[];
};
type DayInput = {
  name?: string;
  blocks?: BlockInput[];
};
type PlanInput = { name?: string; days?: DayInput[] };

async function validatePlan(plan: PlanInput, userId: number): Promise<string | null> {
  if (typeof plan.name !== 'string' || !plan.name.trim()) {
    return 'name ist erforderlich';
  }

  const methodIds = new Set<number>();
  for (const day of plan.days ?? []) {
    if (typeof day.name !== 'string' || !day.name.trim()) {
      return 'jeder Trainingstag benötigt einen Namen';
    }
    if (!day.blocks || day.blocks.length === 0) {
      return 'jeder Trainingstag benötigt mindestens einen Block';
    }
    for (const block of day.blocks) {
      if (!Number.isInteger(block.training_method_id)) {
        return 'jeder Block benötigt eine gültige training_method_id';
      }
      methodIds.add(block.training_method_id!);
    }
  }

  const methodsResult = await pool.query<{ id: number; scope: Scope; timing_family: string }>(
    'SELECT id, scope, timing_family FROM training_methods WHERE id = ANY($1) AND user_id = $2',
    [Array.from(methodIds), userId],
  );
  const methodById = new Map(methodsResult.rows.map((row) => [row.id, row]));

  const exerciseIds = new Set<number>();
  for (const day of plan.days ?? []) {
    for (const block of day.blocks ?? []) {
      for (const exercise of block.exercises ?? []) {
        if (Number.isInteger(exercise.exercise_id)) exerciseIds.add(exercise.exercise_id!);
      }
    }
  }
  const exercisesResult = await pool.query<{ id: number; is_unilateral: boolean }>(
    'SELECT id, is_unilateral FROM exercises WHERE id = ANY($1) AND user_id = $2',
    [Array.from(exerciseIds), userId],
  );
  const isUnilateralById = new Map(exercisesResult.rows.map((row) => [row.id, row.is_unilateral]));

  for (const day of plan.days ?? []) {
    for (const block of day.blocks ?? []) {
      const method = methodById.get(block.training_method_id!);
      if (!method) return 'unbekannte training_method_id';

      const exercises = block.exercises ?? [];
      const countError = exerciseCountError(method.scope, exercises.length);
      if (countError) return countError;

      for (const exercise of exercises) {
        if (!Number.isInteger(exercise.exercise_id)) {
          return 'jede Übung benötigt eine gültige exercise_id';
        }
        // Fremde Übungen fallen hier ebenfalls raus (Abfrage oben ist auf den Benutzer eingeschränkt).
        if (!isUnilateralById.has(exercise.exercise_id!)) {
          return 'unbekannte exercise_id';
        }
        if (exercise.is_unilateral_active) {
          const allowsUnilateral =
            method.timing_family === 'fixed-window-remainder' ||
            method.timing_family === 'fixed-work-rest' ||
            (method.timing_family === 'self-paced' && method.scope === 'single');
          if (!allowsUnilateral) {
            return 'einseitig geloggte Sätze sind beim Zirkel-Intervall nicht möglich';
          }
          if (!isUnilateralById.get(exercise.exercise_id!)) {
            return 'diese Übung kann nicht einseitig ausgeführt werden';
          }
        }
      }
    }
  }

  return null;
}

async function insertDays(client: PoolClient, planId: number, days: DayInput[]) {
  for (const [dayIndex, day] of days.entries()) {
    const dayResult = await client.query<{ id: number }>(
      `INSERT INTO plan_days (plan_id, name, day_order) VALUES ($1, $2, $3) RETURNING id`,
      [planId, day.name!.trim(), dayIndex],
    );
    const planDayId = dayResult.rows[0].id;

    for (const [blockIndex, block] of (day.blocks ?? []).entries()) {
      const blockResult = await client.query<{ id: number }>(
        `INSERT INTO plan_blocks (plan_day_id, block_order, training_method_id) VALUES ($1, $2, $3) RETURNING id`,
        [planDayId, blockIndex, block.training_method_id],
      );
      const planBlockId = blockResult.rows[0].id;

      for (const [exerciseIndex, exercise] of (block.exercises ?? []).entries()) {
        await client.query(
          `INSERT INTO plan_block_exercises (plan_block_id, exercise_id, exercise_order, reps_min, reps_max, note, is_unilateral_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            planBlockId,
            exercise.exercise_id,
            exerciseIndex,
            exercise.reps_min ?? null,
            exercise.reps_max ?? null,
            exercise.note?.trim() || null,
            Boolean(exercise.is_unilateral_active),
          ],
        );
      }
    }
  }
}

async function loadPlanDetail(planId: number, userId: number) {
  const planResult = await pool.query('SELECT id, name, source, created_at FROM plans WHERE id = $1 AND user_id = $2', [
    planId,
    userId,
  ]);
  if (planResult.rows.length === 0) return null;

  const daysResult = await pool.query(
    'SELECT id, name, day_order FROM plan_days WHERE plan_id = $1 ORDER BY day_order',
    [planId],
  );

  const blocksResult = await pool.query(
    `SELECT pb.id, pb.plan_day_id, pb.block_order, tm.id AS training_method_id, tm.name, tm.scope, tm.timing_family,
            tm.window_seconds, tm.work_seconds, tm.rest_seconds, tm.rest_formula, tm.rest_factor,
            tm.stop_condition, tm.rounds, tm.total_duration_seconds
     FROM plan_blocks pb
     JOIN plan_days pd ON pd.id = pb.plan_day_id
     JOIN training_methods tm ON tm.id = pb.training_method_id
     WHERE pd.plan_id = $1
     ORDER BY pb.block_order`,
    [planId],
  );

  const exercisesResult = await pool.query(
    `SELECT pbe.id, pbe.plan_block_id, pbe.exercise_id, pbe.exercise_order, pbe.reps_min, pbe.reps_max, pbe.note,
            pbe.is_unilateral_active, e.name AS exercise_name
     FROM plan_block_exercises pbe
     JOIN plan_blocks pb ON pb.id = pbe.plan_block_id
     JOIN plan_days pd ON pd.id = pb.plan_day_id
     JOIN exercises e ON e.id = pbe.exercise_id
     WHERE pd.plan_id = $1
     ORDER BY pbe.exercise_order`,
    [planId],
  );

  const exercisesByBlock = new Map<number, unknown[]>();
  for (const exercise of exercisesResult.rows) {
    const list = exercisesByBlock.get(exercise.plan_block_id) ?? [];
    list.push({
      id: exercise.id,
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.exercise_name,
      exercise_order: exercise.exercise_order,
      reps_min: exercise.reps_min,
      reps_max: exercise.reps_max,
      note: exercise.note,
      is_unilateral_active: exercise.is_unilateral_active,
    });
    exercisesByBlock.set(exercise.plan_block_id, list);
  }

  const blocksByDay = new Map<number, unknown[]>();
  for (const block of blocksResult.rows) {
    const list = blocksByDay.get(block.plan_day_id) ?? [];
    list.push({
      id: block.id,
      block_order: block.block_order,
      training_method: {
        id: block.training_method_id,
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
      exercises: exercisesByBlock.get(block.id) ?? [],
    });
    blocksByDay.set(block.plan_day_id, list);
  }

  return {
    ...planResult.rows[0],
    days: daysResult.rows.map((day) => ({
      id: day.id,
      name: day.name,
      day_order: day.day_order,
      blocks: blocksByDay.get(day.id) ?? [],
    })),
  };
}

plansRouter.get('/', async (req, res) => {
  const result = await pool.query(
    `SELECT p.id, p.name, p.source, p.created_at,
            COUNT(pd.id)::int AS day_count
     FROM plans p
     LEFT JOIN plan_days pd ON pd.plan_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [currentUser(req).id],
  );
  res.json(result.rows);
});

plansRouter.get('/:id', async (req, res) => {
  const planId = Number(req.params.id);
  const plan = await loadPlanDetail(planId, currentUser(req).id);
  if (!plan) {
    res.status(404).json({ message: 'Plan nicht gefunden' });
    return;
  }
  res.json(plan);
});

plansRouter.post('/', async (req, res) => {
  const userId = currentUser(req).id;
  const plan = (req.body ?? {}) as PlanInput;
  const error = await validatePlan(plan, userId);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const planResult = await client.query<{ id: number }>('INSERT INTO plans (user_id, name) VALUES ($1, $2) RETURNING id', [
      userId,
      plan.name!.trim(),
    ]);
    const planId = planResult.rows[0].id;
    await insertDays(client, planId, plan.days ?? []);
    await client.query('COMMIT');
    res.status(201).json(await loadPlanDetail(planId, userId));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: (err as Error).message });
  } finally {
    client.release();
  }
});

plansRouter.put('/:id', async (req, res) => {
  const planId = Number(req.params.id);
  const userId = currentUser(req).id;
  const plan = (req.body ?? {}) as PlanInput;
  const error = await validatePlan(plan, userId);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updateResult = await client.query('UPDATE plans SET name = $1 WHERE id = $2 AND user_id = $3', [
      plan.name!.trim(),
      planId,
      userId,
    ]);
    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Plan nicht gefunden' });
      return;
    }
    await client.query('DELETE FROM plan_days WHERE plan_id = $1', [planId]);
    await insertDays(client, planId, plan.days ?? []);
    await client.query('COMMIT');
    res.json(await loadPlanDetail(planId, userId));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: (err as Error).message });
  } finally {
    client.release();
  }
});

plansRouter.delete('/:id', async (req, res) => {
  const planId = Number(req.params.id);
  const result = await pool.query('DELETE FROM plans WHERE id = $1 AND user_id = $2', [planId, currentUser(req).id]);
  if (result.rowCount === 0) {
    res.status(404).json({ message: 'Plan nicht gefunden' });
    return;
  }
  res.status(204).send();
});
