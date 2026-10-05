-- Running a training (M4). day_snapshot freezes the training day at start time so that
-- later plan edits (PUT replaces plan_days entirely) don't change/delete the history.
CREATE TABLE training_sessions (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  plan_day_id INTEGER REFERENCES plan_days(id) ON DELETE SET NULL,
  day_snapshot JSONB NOT NULL,
  week_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'aborted')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- unit_index is scaled per exercise: round (interval/superset/hiit), step (ladder), rep tick (circuit).
CREATE TABLE logged_sets (
  id SERIAL PRIMARY KEY,
  training_session_id INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  unit_index INTEGER NOT NULL,
  reps INTEGER,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX logged_sets_exercise_id_performed_at_idx ON logged_sets(exercise_id, performed_at);
CREATE INDEX training_sessions_plan_id_idx ON training_sessions(plan_id);
