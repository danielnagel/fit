-- Demo-Modus (MODE=demo): jeder Besucher bekommt einen eigenen Wegwerf-Benutzer mit Beispieldaten.
-- demo_expires_at ist nur bei diesen gesetzt; danach wird der Login abgewiesen und der Benutzer samt
-- Daten vom Aufraeum-Job geloescht (siehe src/demo.ts).
ALTER TABLE users ADD COLUMN demo_expires_at TIMESTAMPTZ;
CREATE INDEX users_demo_expires_at_idx ON users(demo_expires_at) WHERE demo_expires_at IS NOT NULL;
