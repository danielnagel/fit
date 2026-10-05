-- Multi-user groundwork: fixed default user row (id=1), auth comes later (see 0017).
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO users (id, name) VALUES (1, 'Default');
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

CREATE TABLE exercises (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
