-- Plaene laufen ohne festen Zeitraum: woechentlicher Zyklus, wiederholt bis der Nutzer ihn aendert.
ALTER TABLE plans DROP COLUMN start_date;
ALTER TABLE plans DROP COLUMN end_date;

-- Stufensatz (Ladder): Wiederholungen steigen bis zum persoenlichen Maximum und wieder runter,
-- begrenzt durch ein Zeitbudget (target_duration_seconds) statt einer festen Wiederholungszahl.
ALTER TABLE planned_sets ADD COLUMN type TEXT NOT NULL DEFAULT 'normal' CHECK (type IN ('normal', 'ladder'));
ALTER TABLE planned_sets ADD COLUMN step_rest_seconds INTEGER;
