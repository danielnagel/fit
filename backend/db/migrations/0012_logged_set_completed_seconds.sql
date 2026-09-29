-- Intervallsatz: statt die Laufzeit zu pausieren, wird festgehalten, nach wie vielen Sekunden
-- innerhalb des Zeitfensters der Satz (die Belastung) abgeschlossen wurde. Die restliche Zeit bis
-- zum Rundenende gilt als Pause. NULL, wenn kein Abschluss markiert wurde (z.B. bei anderen
-- Trainingsmethoden oder wenn die Runde ohne Markierung endet).
ALTER TABLE logged_sets ADD COLUMN completed_seconds INTEGER;
