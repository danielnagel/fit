-- Ob eine einseitige Uebung (exercises.is_unilateral) in einem konkreten Satz eines Plans
-- tatsaechlich seitengetrennt geloggt werden soll, ist zu speziell fuer die Uebung selbst und
-- wird daher pro plan_block_exercises-Eintrag aktiviert. Die App-Validierung (siehe plans.ts)
-- laesst das nur zu, wenn die Uebung is_unilateral ist und der Block eine Trainingsmethode mit
-- timing_family = 'fixed-window-remainder' nutzt (aktuell Intervallsatz und Supersatz).
ALTER TABLE plan_block_exercises ADD COLUMN is_unilateral_active BOOLEAN NOT NULL DEFAULT false;
