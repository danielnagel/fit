-- User management: login fields on users, ownership (user_id) on all root tables.
-- Afterwards all existing data belongs to the default user (id=1). It gets no
-- credentials and therefore can't log in; the CLI (user:assign-data) moves its data
-- to a real user. Child tables (plan_days, plan_blocks, training_sessions,
-- logged_sets, ...) hang off plans/plan_weeks via FK, their ownership derives from those.
ALTER TABLE users ADD COLUMN username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD CONSTRAINT users_login_complete
  CHECK ((username IS NULL) = (password_hash IS NULL));

ALTER TABLE exercises ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE training_methods ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
-- Denormalized (actually derivable via plans) so that the partial unique index
-- "one active week per user" below is possible.
ALTER TABLE plan_weeks ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

UPDATE exercises SET user_id = 1;
UPDATE training_methods SET user_id = 1;
UPDATE plan_weeks pw SET user_id = p.user_id FROM plans p WHERE p.id = pw.plan_id;

ALTER TABLE exercises ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE training_methods ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE plan_weeks ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE plans ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE plans DROP CONSTRAINT plans_user_id_fkey;
ALTER TABLE plans ADD CONSTRAINT plans_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Uniqueness per user instead of globally.
ALTER TABLE exercises DROP CONSTRAINT exercises_name_key;
CREATE UNIQUE INDEX exercises_user_name_idx ON exercises(user_id, name);

DROP INDEX plan_weeks_single_active_idx;
CREATE UNIQUE INDEX plan_weeks_single_active_idx ON plan_weeks(user_id) WHERE ended_at IS NULL;

CREATE INDEX plans_user_id_idx ON plans(user_id);
CREATE INDEX training_methods_user_id_idx ON training_methods(user_id);
CREATE INDEX plan_weeks_user_id_idx ON plan_weeks(user_id);
