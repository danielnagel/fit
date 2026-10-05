-- Replaces the hard-coded training methods (plan_days.type) with a user-configurable
-- catalog (see docs/GENERIC_TRAINING_METHODS.md). From now on a training day consists of
-- several blocks (plan_blocks), each block references a catalog method (training_methods).
CREATE TABLE training_methods (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('single', 'pair', 'all')),
  timing_family TEXT NOT NULL CHECK (timing_family IN ('fixed-window-remainder', 'fixed-work-rest', 'self-paced')),
  -- fixed-window-remainder: window duration per round.
  window_seconds INTEGER,
  -- fixed-work-rest: work duration per round.
  work_seconds INTEGER,
  -- fixed-work-rest: rest per round; self-paced+rest_formula=fixed: constant rest after each set.
  rest_seconds INTEGER,
  -- self-paced only: how the rest is calculated.
  rest_formula TEXT CHECK (rest_formula IN ('proportional', 'fixed')),
  -- self-paced+rest_formula=proportional: factor x measured set duration.
  rest_factor NUMERIC,
  stop_condition TEXT NOT NULL CHECK (stop_condition IN ('fixed-count', 'time-budget', 'all-exercises-done')),
  -- stop_condition=fixed-count: fixed number of rounds.
  rounds INTEGER,
  -- stop_condition=time-budget: time budget with grace (the current unit may still be finished).
  total_duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO training_methods
  (name, scope, timing_family, window_seconds, work_seconds, rest_seconds, rest_formula, rest_factor, stop_condition, rounds, total_duration_seconds)
VALUES
  ('Intervallsatz', 'single', 'fixed-window-remainder', 180, NULL, NULL, NULL, NULL, 'fixed-count', 3, NULL),
  ('Stufensatz', 'single', 'self-paced', NULL, NULL, NULL, 'proportional', 1.0, 'time-budget', NULL, 450),
  ('Supersatz', 'pair', 'fixed-window-remainder', 240, NULL, NULL, NULL, NULL, 'fixed-count', 2, NULL),
  -- reworked: one exercise after the other in turn instead of tapping all at once without rest.
  ('Zirkel-Intervall', 'all', 'self-paced', NULL, NULL, NULL, 'proportional', 0.5, 'time-budget', NULL, 1200),
  ('Hochintensitaetssatz', 'single', 'fixed-work-rest', NULL, 20, 10, NULL, NULL, 'fixed-count', 8, NULL);

CREATE TABLE plan_blocks (
  id SERIAL PRIMARY KEY,
  plan_day_id INTEGER NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  block_order INTEGER NOT NULL,
  training_method_id INTEGER NOT NULL REFERENCES training_methods(id)
);

CREATE TABLE plan_block_exercises (
  id SERIAL PRIMARY KEY,
  plan_block_id INTEGER NOT NULL REFERENCES plan_blocks(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  exercise_order INTEGER NOT NULL,
  reps_min INTEGER,
  reps_max INTEGER,
  note TEXT
);

CREATE INDEX plan_blocks_plan_day_id_idx ON plan_blocks(plan_day_id);
CREATE INDEX plan_block_exercises_plan_block_id_idx ON plan_block_exercises(plan_block_id);

-- Data migration: every existing plan_days row gets its own catalog entry with its
-- exact historical values (not mapped onto the seed rows above, so that individual
-- deviations from the defaults are kept) and exactly one block pointing at it.
ALTER TABLE training_methods ADD COLUMN migrated_from_plan_day_id INTEGER;

WITH migrated AS (
  INSERT INTO training_methods
    (name, scope, timing_family, window_seconds, work_seconds, rest_seconds, rest_formula, rest_factor,
     stop_condition, rounds, total_duration_seconds, migrated_from_plan_day_id)
  SELECT
    (CASE pd.type
       WHEN 'interval' THEN 'Intervallsatz'
       WHEN 'ladder' THEN 'Stufensatz'
       WHEN 'superset' THEN 'Supersatz'
       WHEN 'circuit' THEN 'Zirkel-Intervall'
       WHEN 'hiit' THEN 'Hochintensitaetssatz'
     END) || ' – ' || pd.name,
    CASE pd.type WHEN 'superset' THEN 'pair' WHEN 'circuit' THEN 'all' ELSE 'single' END,
    CASE pd.type
      WHEN 'hiit' THEN 'fixed-work-rest'
      WHEN 'ladder' THEN 'self-paced'
      WHEN 'circuit' THEN 'self-paced'
      ELSE 'fixed-window-remainder'
    END,
    CASE WHEN pd.type IN ('interval', 'superset') THEN pd.round_duration_seconds END,
    CASE WHEN pd.type = 'hiit' THEN pd.work_seconds END,
    CASE WHEN pd.type = 'hiit' THEN pd.rest_seconds END,
    CASE WHEN pd.type IN ('ladder', 'circuit') THEN 'proportional' END,
    CASE WHEN pd.type = 'ladder' THEN 1.0 WHEN pd.type = 'circuit' THEN 0.5 END,
    CASE WHEN pd.type IN ('ladder', 'circuit') THEN 'time-budget' ELSE 'fixed-count' END,
    CASE WHEN pd.type IN ('interval', 'superset', 'hiit') THEN pd.rounds END,
    CASE WHEN pd.type IN ('ladder', 'circuit') THEN pd.total_duration_seconds END,
    pd.id
  FROM plan_days pd
  RETURNING id, migrated_from_plan_day_id
)
INSERT INTO plan_blocks (plan_day_id, block_order, training_method_id)
SELECT migrated_from_plan_day_id, 0, id FROM migrated;

ALTER TABLE training_methods DROP COLUMN migrated_from_plan_day_id;

INSERT INTO plan_block_exercises (plan_block_id, exercise_id, exercise_order, reps_min, reps_max, note)
SELECT pb.id, pde.exercise_id, pde.exercise_order, pde.reps_min, pde.reps_max, pde.note
FROM plan_day_exercises pde
JOIN plan_blocks pb ON pb.plan_day_id = pde.plan_day_id;

DROP TABLE plan_day_exercises;

ALTER TABLE plan_days
  DROP COLUMN type,
  DROP COLUMN rounds,
  DROP COLUMN rest_seconds,
  DROP COLUMN round_duration_seconds,
  DROP COLUMN work_seconds,
  DROP COLUMN total_duration_seconds;
