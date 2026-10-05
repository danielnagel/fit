-- Replaces the flat model (one set type per exercise) with training blocks that can also
-- represent several related exercises (superset, circuit, high-intensity set).
DROP TABLE planned_sets;
DROP TABLE plan_day_exercises;

CREATE TABLE plan_blocks (
  id SERIAL PRIMARY KEY,
  plan_day_id INTEGER NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  block_order INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('interval', 'ladder', 'superset', 'circuit', 'hiit')),
  -- interval: number of sets; superset: number of rounds; hiit: number of rounds (20s/10s each); otherwise NULL.
  rounds INTEGER,
  -- interval: rest between sets; hiit: rest between reps within a round; otherwise NULL.
  rest_seconds INTEGER,
  -- superset: target round duration (default 4 min).
  round_duration_seconds INTEGER,
  -- hiit: work duration per rep (default 20s).
  work_seconds INTEGER,
  -- ladder: time budget (default 7.5 min); circuit: fixed total duration (default 20 min).
  total_duration_seconds INTEGER,
  -- ladder: rest between steps.
  step_rest_seconds INTEGER
);

CREATE TABLE plan_block_exercises (
  id SERIAL PRIMARY KEY,
  plan_block_id INTEGER NOT NULL REFERENCES plan_blocks(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  exercise_order INTEGER NOT NULL,
  -- interval exercise and superset slots (heavy/light) have a target rep range; circuit/hiit/ladder: NULL.
  reps_min INTEGER,
  reps_max INTEGER,
  note TEXT
);

CREATE INDEX plan_blocks_plan_day_id_idx ON plan_blocks(plan_day_id);
CREATE INDEX plan_block_exercises_plan_block_id_idx ON plan_block_exercises(plan_block_id);
