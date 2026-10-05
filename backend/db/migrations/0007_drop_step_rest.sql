-- Ladder rests equal the duration of the preceding
-- work interval (dynamic at execution time, not a fixed plan value) -- the column goes away.
ALTER TABLE plan_days DROP COLUMN step_rest_seconds;
