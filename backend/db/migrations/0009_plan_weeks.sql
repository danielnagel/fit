-- Woche wird vom System getrackt (Start/Ende-Zeitstempel), statt dass der Nutzer eine Wochennummer eintippt.
-- Es kann global immer nur eine aktive Woche geben (unabhaengig vom Plan) -- der laufende Plan muss erst
-- beendet werden, bevor eine neue Woche (auch fuer einen anderen Plan) gestartet werden kann.
DROP TABLE logged_sets;
DROP TABLE training_sessions;

CREATE TABLE plan_weeks (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX plan_weeks_single_active_idx ON plan_weeks ((true)) WHERE ended_at IS NULL;
CREATE INDEX plan_weeks_plan_id_idx ON plan_weeks(plan_id);

CREATE TABLE training_sessions (
  id SERIAL PRIMARY KEY,
  plan_week_id INTEGER NOT NULL REFERENCES plan_weeks(id) ON DELETE CASCADE,
  plan_day_id INTEGER REFERENCES plan_days(id) ON DELETE SET NULL,
  day_snapshot JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'aborted')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX training_sessions_plan_week_id_idx ON training_sessions(plan_week_id);

CREATE TABLE logged_sets (
  id SERIAL PRIMARY KEY,
  training_session_id INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  unit_index INTEGER NOT NULL,
  reps INTEGER,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX logged_sets_exercise_id_performed_at_idx ON logged_sets(exercise_id, performed_at);
