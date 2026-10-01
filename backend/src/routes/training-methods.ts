import { Router } from 'express';
import { pool } from '../db.js';
import { currentUser } from '../middleware/requireAuth.js';

export const trainingMethodsRouter = Router();

type Scope = 'single' | 'pair' | 'all';
type TimingFamily = 'fixed-window-remainder' | 'fixed-work-rest' | 'self-paced';
type RestFormula = 'proportional' | 'fixed';
type StopCondition = 'fixed-count' | 'time-budget' | 'all-exercises-done';

const SCOPES: Scope[] = ['single', 'pair', 'all'];
const TIMING_FAMILIES: TimingFamily[] = ['fixed-window-remainder', 'fixed-work-rest', 'self-paced'];
const REST_FORMULAS: RestFormula[] = ['proportional', 'fixed'];
const STOP_CONDITIONS: StopCondition[] = ['fixed-count', 'time-budget', 'all-exercises-done'];

type TrainingMethodInput = {
  name?: string;
  scope?: Scope;
  timing_family?: TimingFamily;
  window_seconds?: number | null;
  work_seconds?: number | null;
  rest_seconds?: number | null;
  rest_formula?: RestFormula | null;
  rest_factor?: number | null;
  stop_condition?: StopCondition;
  rounds?: number | null;
  total_duration_seconds?: number | null;
};

function validateTrainingMethod(input: TrainingMethodInput): string | null {
  if (typeof input.name !== 'string' || !input.name.trim()) {
    return 'name ist erforderlich';
  }
  if (!input.scope || !SCOPES.includes(input.scope)) {
    return 'ungültiger scope';
  }
  if (!input.timing_family || !TIMING_FAMILIES.includes(input.timing_family)) {
    return 'ungültige timing_family';
  }

  switch (input.timing_family) {
    case 'fixed-window-remainder':
      if (!Number.isInteger(input.window_seconds) || input.window_seconds! <= 0) {
        return 'window_seconds ist erforderlich';
      }
      break;
    case 'fixed-work-rest':
      if (!Number.isInteger(input.work_seconds) || input.work_seconds! <= 0) {
        return 'work_seconds ist erforderlich';
      }
      if (!Number.isInteger(input.rest_seconds) || input.rest_seconds! <= 0) {
        return 'rest_seconds ist erforderlich';
      }
      break;
    case 'self-paced':
      if (!input.rest_formula || !REST_FORMULAS.includes(input.rest_formula)) {
        return 'rest_formula ist erforderlich';
      }
      if (input.rest_formula === 'proportional' && (typeof input.rest_factor !== 'number' || input.rest_factor <= 0)) {
        return 'rest_factor ist erforderlich';
      }
      if (input.rest_formula === 'fixed' && (!Number.isInteger(input.rest_seconds) || input.rest_seconds! < 0)) {
        return 'rest_seconds ist erforderlich';
      }
      break;
  }

  if (!input.stop_condition || !STOP_CONDITIONS.includes(input.stop_condition)) {
    return 'ungültige stop_condition';
  }
  if (input.stop_condition === 'fixed-count' && (!Number.isInteger(input.rounds) || input.rounds! <= 0)) {
    return 'rounds ist erforderlich';
  }
  if (
    input.stop_condition === 'time-budget' &&
    (!Number.isInteger(input.total_duration_seconds) || input.total_duration_seconds! <= 0)
  ) {
    return 'total_duration_seconds ist erforderlich';
  }

  return null;
}

// Nur die zur timing_family/stop_condition passenden Spalten behalten, Rest auf NULL setzen —
// gleiches Muster wie frueher bei plan_days.type (siehe 0006_day_is_block.sql).
function normalize(input: TrainingMethodInput) {
  return {
    name: input.name!.trim(),
    scope: input.scope!,
    timing_family: input.timing_family!,
    window_seconds: input.timing_family === 'fixed-window-remainder' ? input.window_seconds! : null,
    work_seconds: input.timing_family === 'fixed-work-rest' ? input.work_seconds! : null,
    rest_seconds:
      input.timing_family === 'fixed-work-rest'
        ? input.rest_seconds!
        : input.timing_family === 'self-paced' && input.rest_formula === 'fixed'
          ? input.rest_seconds!
          : null,
    rest_formula: input.timing_family === 'self-paced' ? input.rest_formula! : null,
    rest_factor: input.timing_family === 'self-paced' && input.rest_formula === 'proportional' ? input.rest_factor! : null,
    stop_condition: input.stop_condition!,
    rounds: input.stop_condition === 'fixed-count' ? input.rounds! : null,
    total_duration_seconds: input.stop_condition === 'time-budget' ? input.total_duration_seconds! : null,
  };
}

const COLUMNS =
  'id, name, scope, timing_family, window_seconds, work_seconds, rest_seconds, rest_formula, rest_factor, stop_condition, rounds, total_duration_seconds, created_at';

trainingMethodsRouter.get('/', async (req, res) => {
  const result = await pool.query(`SELECT ${COLUMNS} FROM training_methods WHERE user_id = $1 ORDER BY name`, [
    currentUser(req).id,
  ]);
  res.json(result.rows);
});

trainingMethodsRouter.get('/:id', async (req, res) => {
  const result = await pool.query(`SELECT ${COLUMNS} FROM training_methods WHERE id = $1 AND user_id = $2`, [
    req.params.id,
    currentUser(req).id,
  ]);
  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Trainingsmethode nicht gefunden' });
    return;
  }
  res.json(result.rows[0]);
});

trainingMethodsRouter.post('/', async (req, res) => {
  const input = (req.body ?? {}) as TrainingMethodInput;
  const error = validateTrainingMethod(input);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const m = normalize(input);
  const result = await pool.query(
    `INSERT INTO training_methods
       (user_id, name, scope, timing_family, window_seconds, work_seconds, rest_seconds, rest_formula, rest_factor,
        stop_condition, rounds, total_duration_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${COLUMNS}`,
    [
      currentUser(req).id,
      m.name,
      m.scope,
      m.timing_family,
      m.window_seconds,
      m.work_seconds,
      m.rest_seconds,
      m.rest_formula,
      m.rest_factor,
      m.stop_condition,
      m.rounds,
      m.total_duration_seconds,
    ],
  );
  res.status(201).json(result.rows[0]);
});

trainingMethodsRouter.put('/:id', async (req, res) => {
  const input = (req.body ?? {}) as TrainingMethodInput;
  const error = validateTrainingMethod(input);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const m = normalize(input);
  const result = await pool.query(
    `UPDATE training_methods
     SET name = $1, scope = $2, timing_family = $3, window_seconds = $4, work_seconds = $5, rest_seconds = $6,
         rest_formula = $7, rest_factor = $8, stop_condition = $9, rounds = $10, total_duration_seconds = $11
     WHERE id = $12 AND user_id = $13
     RETURNING ${COLUMNS}`,
    [
      m.name,
      m.scope,
      m.timing_family,
      m.window_seconds,
      m.work_seconds,
      m.rest_seconds,
      m.rest_formula,
      m.rest_factor,
      m.stop_condition,
      m.rounds,
      m.total_duration_seconds,
      req.params.id,
      currentUser(req).id,
    ],
  );
  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Trainingsmethode nicht gefunden' });
    return;
  }
  res.json(result.rows[0]);
});

trainingMethodsRouter.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM training_methods WHERE id = $1 AND user_id = $2', [
      req.params.id,
      currentUser(req).id,
    ]);
    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Trainingsmethode nicht gefunden' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    if ((err as { code?: string }).code === '23503') {
      res.status(409).json({ message: 'Trainingsmethode wird noch in einem Plan verwendet' });
      return;
    }
    res.status(500).json({ message: (err as Error).message });
  }
});
