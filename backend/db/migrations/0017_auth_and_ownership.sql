-- Benutzerverwaltung: Login-Felder an users, Besitz (user_id) an allen Wurzel-Tabellen.
-- Alle bestehenden Daten gehoeren danach dem Default-User (id=1). Dieser bekommt keine
-- Credentials und ist damit nicht einloggbar; per CLI (user:assign-data) werden seine Daten
-- auf einen echten Benutzer uebertragen. Kindtabellen (plan_days, plan_blocks, training_sessions,
-- logged_sets, ...) haengen per FK an plans/plan_weeks, ihr Besitz ist darueber ableitbar.
ALTER TABLE users ADD COLUMN username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD CONSTRAINT users_login_complete
  CHECK ((username IS NULL) = (password_hash IS NULL));

ALTER TABLE exercises ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE training_methods ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
-- Denormalisiert (eigentlich ueber plans ableitbar), damit der Partial-Unique-Index
-- "eine aktive Woche pro User" unten moeglich ist.
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

-- Eindeutigkeit pro Benutzer statt global.
ALTER TABLE exercises DROP CONSTRAINT exercises_name_key;
CREATE UNIQUE INDEX exercises_user_name_idx ON exercises(user_id, name);

DROP INDEX plan_weeks_single_active_idx;
CREATE UNIQUE INDEX plan_weeks_single_active_idx ON plan_weeks(user_id) WHERE ended_at IS NULL;

CREATE INDEX plans_user_id_idx ON plans(user_id);
CREATE INDEX training_methods_user_id_idx ON training_methods(user_id);
CREATE INDEX plan_weeks_user_id_idx ON plan_weeks(user_id);
