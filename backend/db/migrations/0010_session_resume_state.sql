-- Server-seitiger Zustand fuers Fortsetzen einer Session (Geraetewechsel/Reload):
-- welche Uebungen manuell beendet wurden (Ladder hat keine feste Stufenzahl, daher
-- nicht aus logged_sets ableitbar) und ein grober Zeit-Anker je Timer-Slot.
CREATE TABLE session_finished_exercises (
  training_session_id INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (training_session_id, exercise_id)
);

-- slot erlaubt bis zu zwei gleichzeitig laufende Timer pro Session (Ladder braucht
-- Stufen-Zeit und Uebungs-Zeitbudget parallel). started_at + duration_seconds
-- reichen, um beim naechsten Laden die verbleibende/verstrichene Zeit ungefaehr
-- zu rekonstruieren -- Praezision auf die Sekunde wird nicht benoetigt.
CREATE TABLE session_timer_anchors (
  training_session_id INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('primary', 'secondary')),
  phase_key TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (training_session_id, slot)
);
