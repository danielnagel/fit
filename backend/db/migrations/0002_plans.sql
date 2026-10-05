-- Photo import audit trail; only filled from M7 on, the table already exists for the FK on plans.
CREATE TABLE plan_import_images (
  id SERIAL PRIMARY KEY,
  image_path TEXT NOT NULL,
  llm_response JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) DEFAULT 1,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'photo_import')),
  plan_import_image_id INTEGER REFERENCES plan_import_images(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Training day template in the weekly plan cycle (e.g. "Push Day"), day_order for ordering/display.
CREATE TABLE plan_days (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_order INTEGER NOT NULL
);

CREATE TABLE plan_day_exercises (
  id SERIAL PRIMARY KEY,
  plan_day_id INTEGER NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  exercise_order INTEGER NOT NULL
);

-- One row per planned set; either target reps or target duration (e.g. plank), never both required.
CREATE TABLE planned_sets (
  id SERIAL PRIMARY KEY,
  plan_day_exercise_id INTEGER NOT NULL REFERENCES plan_day_exercises(id) ON DELETE CASCADE,
  set_order INTEGER NOT NULL,
  target_reps INTEGER,
  target_duration_seconds INTEGER,
  rest_seconds INTEGER
);

CREATE INDEX plan_days_plan_id_idx ON plan_days(plan_id);
CREATE INDEX plan_day_exercises_plan_day_id_idx ON plan_day_exercises(plan_day_id);
CREATE INDEX planned_sets_plan_day_exercise_id_idx ON planned_sets(plan_day_exercise_id);
