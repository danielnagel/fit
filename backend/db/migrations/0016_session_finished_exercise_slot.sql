-- Gleiches Problem wie bei logged_sets (siehe Migration 0015), nur fuer den "manuell beenden"-
-- Abschluss (stop_condition = all-exercises-done): eine Uebung kann als andere Variante
-- (festgehalten im plan_block_exercises.note, z.B. "leicht"/"schwer") mehrfach im selben Block
-- auftauchen. exercise_id allein identifiziert daher nicht zuverlaessig, welcher Slot beendet
-- wurde -- exercise_id ist nur die Taxonomie der Uebung, nicht die des Plan-Eintrags.
--
-- plan_block_exercise_id identifiziert wie bei logged_sets den konkreten Slot im eingefrorenen
-- day_snapshot. Bewusst ohne Foreign Key auf plan_block_exercises (Snapshot-Charakter, siehe
-- Migration 0015). Die alte Primaerschlüssel-Eindeutigkeit ueber (training_session_id,
-- exercise_id) reicht nicht mehr, da derselbe exercise_id jetzt mehrfach pro Session vorkommen
-- kann -- daher zwei partielle Unique-Indizes statt einer einzelnen Primaerschluessel-Spalte:
-- neue Zeilen werden pro Slot dedupliziert, bestehende (plan_block_exercise_id IS NULL) bleiben
-- wie bisher pro exercise_id dedupliziert.
ALTER TABLE session_finished_exercises DROP CONSTRAINT session_finished_exercises_pkey;
ALTER TABLE session_finished_exercises ADD COLUMN plan_block_exercise_id INTEGER;

CREATE UNIQUE INDEX session_finished_exercises_slot_uniq
  ON session_finished_exercises (training_session_id, plan_block_exercise_id)
  WHERE plan_block_exercise_id IS NOT NULL;

CREATE UNIQUE INDEX session_finished_exercises_legacy_uniq
  ON session_finished_exercises (training_session_id, exercise_id)
  WHERE plan_block_exercise_id IS NULL;
