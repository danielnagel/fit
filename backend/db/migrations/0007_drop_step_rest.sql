-- Stufensatz-Pausen entsprechen der Dauer des vorhergehenden
-- Trainingsintervalls (dynamisch zur Ausfuehrungszeit, kein fester Plan-Wert) -- Spalte entfaellt.
ALTER TABLE plan_days DROP COLUMN step_rest_seconds;
