-- Interval set: instead of pausing the clock, we record after how many seconds
-- within the time window the set (the work) was completed. The remaining time until
-- the end of the round counts as rest. NULL if no completion was marked (e.g. for other
-- training methods or when the round ends without a mark).
ALTER TABLE logged_sets ADD COLUMN completed_seconds INTEGER;
