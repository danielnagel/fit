-- Same problem as with logged_sets (see migration 0015), just for the "finish manually"
-- completion (stop_condition = all-exercises-done): an exercise can appear several times
-- in the same block as a different variant (recorded in plan_block_exercises.note, e.g.
-- "light"/"heavy"). exercise_id alone therefore doesn't reliably identify which slot was
-- finished -- exercise_id is only the exercise's taxonomy, not that of the plan entry.
--
-- Like in logged_sets, plan_block_exercise_id identifies the concrete slot in the frozen
-- day_snapshot. Deliberately without a foreign key to plan_block_exercises (snapshot nature, see
-- migration 0015). The old primary key uniqueness over (training_session_id,
-- exercise_id) is no longer sufficient, since the same exercise_id can now occur several times
-- per session -- hence two partial unique indexes instead of a single primary key:
-- new rows are deduplicated per slot, existing ones (plan_block_exercise_id IS NULL) stay
-- deduplicated per exercise_id as before.
ALTER TABLE session_finished_exercises DROP CONSTRAINT session_finished_exercises_pkey;
ALTER TABLE session_finished_exercises ADD COLUMN plan_block_exercise_id INTEGER;

CREATE UNIQUE INDEX session_finished_exercises_slot_uniq
  ON session_finished_exercises (training_session_id, plan_block_exercise_id)
  WHERE plan_block_exercise_id IS NOT NULL;

CREATE UNIQUE INDEX session_finished_exercises_legacy_uniq
  ON session_finished_exercises (training_session_id, exercise_id)
  WHERE plan_block_exercise_id IS NULL;
