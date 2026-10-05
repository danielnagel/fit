-- Unilateral exercises (e.g. alternating left/right arm) are flagged on the exercise;
-- the runner then asks for the side on every set (left preselected). Existing sets
-- stay untouched and therefore automatically have side = NULL.
ALTER TABLE exercises ADD COLUMN is_unilateral BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE logged_sets ADD COLUMN side TEXT CHECK (side IN ('left', 'right'));
