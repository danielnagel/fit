-- Ersetzt das flache Modell (ein Satz-Typ pro Uebung) durch Trainingsbloecke, die auch
-- mehrere zusammengehoerige Uebungen abbilden koennen (Supersatz, Zirkel, Hochintensitaetssatz).
DROP TABLE planned_sets;
DROP TABLE plan_day_exercises;

CREATE TABLE plan_blocks (
  id SERIAL PRIMARY KEY,
  plan_day_id INTEGER NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  block_order INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('interval', 'ladder', 'superset', 'circuit', 'hiit')),
  -- interval: Anzahl Saetze; superset: Anzahl Runden; hiit: Anzahl Runden (je 20s/10s); sonst NULL.
  rounds INTEGER,
  -- interval: Pause zwischen Saetzen; hiit: Pause zwischen Wiederholungen innerhalb einer Runde; sonst NULL.
  rest_seconds INTEGER,
  -- superset: Ziel-Rundendauer (Standard 4 Min).
  round_duration_seconds INTEGER,
  -- hiit: Belastungsdauer je Wiederholung (Standard 20s).
  work_seconds INTEGER,
  -- ladder: Zeitbudget (Standard 7,5 Min); circuit: feste Gesamtdauer (Standard 20 Min).
  total_duration_seconds INTEGER,
  -- ladder: Pause zwischen den Stufen.
  step_rest_seconds INTEGER
);

CREATE TABLE plan_block_exercises (
  id SERIAL PRIMARY KEY,
  plan_block_id INTEGER NOT NULL REFERENCES plan_blocks(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  exercise_order INTEGER NOT NULL,
  -- interval-Uebung und superset-Slots (schwer/leicht) haben ein Ziel-Wiederholungsband; circuit/hiit/ladder: NULL.
  reps_min INTEGER,
  reps_max INTEGER,
  note TEXT
);

CREATE INDEX plan_blocks_plan_day_id_idx ON plan_blocks(plan_day_id);
CREATE INDEX plan_block_exercises_plan_block_id_idx ON plan_block_exercises(plan_block_id);
