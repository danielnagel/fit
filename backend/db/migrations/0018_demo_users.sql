-- Demo mode (MODE=demo): every visitor gets their own throwaway user with example data.
-- demo_expires_at is only set for those; afterwards the login is rejected and the cleanup job
-- deletes the user including all data (see src/demo.ts).
ALTER TABLE users ADD COLUMN demo_expires_at TIMESTAMPTZ;
CREATE INDEX users_demo_expires_at_idx ON users(demo_expires_at) WHERE demo_expires_at IS NOT NULL;
