-- Plans have no fixed time range: weekly cycle, repeated until the user changes it.
ALTER TABLE plans DROP COLUMN start_date;
ALTER TABLE plans DROP COLUMN end_date;

-- Ladder set: reps rise up to the personal maximum and back down again,
-- bounded by a time budget (target_duration_seconds) instead of a fixed rep count.
ALTER TABLE planned_sets ADD COLUMN type TEXT NOT NULL DEFAULT 'normal' CHECK (type IN ('normal', 'ladder'));
ALTER TABLE planned_sets ADD COLUMN step_rest_seconds INTEGER;
