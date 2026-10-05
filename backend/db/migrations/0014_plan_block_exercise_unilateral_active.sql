-- Whether a unilateral exercise (exercises.is_unilateral) should actually be logged per side
-- in a specific set of a plan is too specific for the exercise itself and is therefore
-- enabled per plan_block_exercises entry. The app validation (see plans.ts) only allows
-- it if the exercise is_unilateral and the block uses a training method with
-- timing_family = 'fixed-window-remainder' (currently interval set and superset).
ALTER TABLE plan_block_exercises ADD COLUMN is_unilateral_active BOOLEAN NOT NULL DEFAULT false;
