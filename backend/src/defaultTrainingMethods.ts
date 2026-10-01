import type { PoolClient } from 'pg';

// Gleiche Startwerte wie der urspruengliche Seed in Migration 0011; neue Benutzer bekommen diesen
// Katalog als eigene Kopie (Trainingsmethoden gehoeren je einem Benutzer).
export const DEFAULT_TRAINING_METHODS = [
  { name: 'Intervallsatz', scope: 'single', timing_family: 'fixed-window-remainder', window_seconds: 180, stop_condition: 'fixed-count', rounds: 3 },
  { name: 'Stufensatz', scope: 'single', timing_family: 'self-paced', rest_formula: 'proportional', rest_factor: 1.0, stop_condition: 'time-budget', total_duration_seconds: 450 },
  { name: 'Supersatz', scope: 'pair', timing_family: 'fixed-window-remainder', window_seconds: 240, stop_condition: 'fixed-count', rounds: 2 },
  { name: 'Zirkel-Intervall', scope: 'all', timing_family: 'self-paced', rest_formula: 'proportional', rest_factor: 0.5, stop_condition: 'time-budget', total_duration_seconds: 1200 },
  { name: 'Hochintensitaetssatz', scope: 'single', timing_family: 'fixed-work-rest', work_seconds: 20, rest_seconds: 10, stop_condition: 'fixed-count', rounds: 8 },
] as const;

export async function seedDefaultTrainingMethods(client: PoolClient, userId: number) {
  for (const m of DEFAULT_TRAINING_METHODS) {
    const v = m as Partial<Record<string, string | number>>;
    await client.query(
      `INSERT INTO training_methods
         (user_id, name, scope, timing_family, window_seconds, work_seconds, rest_seconds, rest_formula, rest_factor,
          stop_condition, rounds, total_duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        userId,
        v.name,
        v.scope,
        v.timing_family,
        v.window_seconds ?? null,
        v.work_seconds ?? null,
        v.rest_seconds ?? null,
        v.rest_formula ?? null,
        v.rest_factor ?? null,
        v.stop_condition,
        v.rounds ?? null,
        v.total_duration_seconds ?? null,
      ],
    );
  }
}
