-- A training day consists of exactly one block of one type with several exercises
-- (instead of several blocks per day) -- the block level goes away, type+config move into plan_days.
DROP TABLE plan_block_exercises;
DROP TABLE plan_blocks;

ALTER TABLE plan_days ADD COLUMN type TEXT NOT NULL DEFAULT 'interval'
  CHECK (type IN ('interval', 'ladder', 'superset', 'circuit', 'hiit'));
-- interval: number of sets; superset: number of rounds; hiit: number of rounds (20s/10s each); otherwise NULL.
ALTER TABLE plan_days ADD COLUMN rounds INTEGER;
-- interval: rest between sets; hiit: rest between reps within a round; otherwise NULL.
ALTER TABLE plan_days ADD COLUMN rest_seconds INTEGER;
-- superset: target round duration (default 4 min).
ALTER TABLE plan_days ADD COLUMN round_duration_seconds INTEGER;
-- hiit: work duration per rep (default 20s).
ALTER TABLE plan_days ADD COLUMN work_seconds INTEGER;
-- ladder: time budget (default 7.5 min); circuit: fixed total duration (default 20 min).
ALTER TABLE plan_days ADD COLUMN total_duration_seconds INTEGER;
-- ladder: rest between steps.
ALTER TABLE plan_days ADD COLUMN step_rest_seconds INTEGER;

CREATE TABLE plan_day_exercises (
  id SERIAL PRIMARY KEY,
  plan_day_id INTEGER NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  exercise_order INTEGER NOT NULL,
  -- interval and superset exercises (alternating heavy/light) have a target rep range; otherwise NULL.
  reps_min INTEGER,
  reps_max INTEGER,
  note TEXT
);

CREATE INDEX plan_day_exercises_plan_day_id_idx ON plan_day_exercises(plan_day_id);
