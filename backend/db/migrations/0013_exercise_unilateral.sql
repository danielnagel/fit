-- Einseitige Uebungen (z.B. abwechselnd linker/rechter Arm) werden auf der Uebung markiert;
-- im Runner wird dafuer je Satz die Seite abgefragt (Vorauswahl links). Bestehende Saetze
-- bleiben unangetastet und haben damit automatisch side = NULL.
ALTER TABLE exercises ADD COLUMN is_unilateral BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE logged_sets ADD COLUMN side TEXT CHECK (side IN ('left', 'right'));
