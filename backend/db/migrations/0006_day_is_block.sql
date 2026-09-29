-- Ein Trainingstag besteht aus genau einem Block eines Typs mit mehreren Uebungen
-- (statt mehreren Bloecken je Tag) -- Block-Ebene entfaellt, Typ+Konfiguration wandern in plan_days.
DROP TABLE plan_block_exercises;
DROP TABLE plan_blocks;

ALTER TABLE plan_days ADD COLUMN type TEXT NOT NULL DEFAULT 'interval'
  CHECK (type IN ('interval', 'ladder', 'superset', 'circuit', 'hiit'));
-- interval: Anzahl Saetze; superset: Anzahl Runden; hiit: Anzahl Runden (je 20s/10s); sonst NULL.
ALTER TABLE plan_days ADD COLUMN rounds INTEGER;
-- interval: Pause zwischen Saetzen; hiit: Pause zwischen Wiederholungen innerhalb einer Runde; sonst NULL.
ALTER TABLE plan_days ADD COLUMN rest_seconds INTEGER;
-- superset: Ziel-Rundendauer (Standard 4 Min).
ALTER TABLE plan_days ADD COLUMN round_duration_seconds INTEGER;
-- hiit: Belastungsdauer je Wiederholung (Standard 20s).
ALTER TABLE plan_days ADD COLUMN work_seconds INTEGER;
-- ladder: Zeitbudget (Standard 7,5 Min); circuit: feste Gesamtdauer (Standard 20 Min).
ALTER TABLE plan_days ADD COLUMN total_duration_seconds INTEGER;
-- ladder: Pause zwischen den Stufen.
ALTER TABLE plan_days ADD COLUMN step_rest_seconds INTEGER;

CREATE TABLE plan_day_exercises (
  id SERIAL PRIMARY KEY,
  plan_day_id INTEGER NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  exercise_order INTEGER NOT NULL,
  -- interval- und superset-Uebungen (schwer/leicht im Wechsel) haben ein Ziel-Wiederholungsband; sonst NULL.
  reps_min INTEGER,
  reps_max INTEGER,
  note TEXT
);

CREATE INDEX plan_day_exercises_plan_day_id_idx ON plan_day_exercises(plan_day_id);
