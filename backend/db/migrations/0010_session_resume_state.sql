-- Server-side state for resuming a session (device switch/reload):
-- which exercises were finished manually (ladder has no fixed step count, so this
-- can't be derived from logged_sets) and a rough time anchor per timer slot.
CREATE TABLE session_finished_exercises (
  training_session_id INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (training_session_id, exercise_id)
);

-- slot allows up to two timers running at once per session (ladder needs
-- step time and the exercise time budget in parallel). started_at + duration_seconds
-- are enough to roughly reconstruct the remaining/elapsed time on the next load
-- -- second-level precision isn't needed.
CREATE TABLE session_timer_anchors (
  training_session_id INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('primary', 'secondary')),
  phase_key TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (training_session_id, slot)
);
