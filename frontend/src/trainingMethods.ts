export type Scope = 'single' | 'pair' | 'all';
export type TimingFamily = 'fixed-window-remainder' | 'fixed-work-rest' | 'self-paced';
export type RestFormula = 'proportional' | 'fixed';
export type StopCondition = 'fixed-count' | 'time-budget' | 'all-exercises-done';

export type TrainingMethod = {
  id: number;
  name: string;
  scope: Scope;
  timing_family: TimingFamily;
  window_seconds: number | null;
  work_seconds: number | null;
  rest_seconds: number | null;
  rest_formula: RestFormula | null;
  rest_factor: number | null;
  stop_condition: StopCondition;
  rounds: number | null;
  total_duration_seconds: number | null;
};

export const SCOPE_LABELS: Record<Scope, string> = {
  single: 'Einzelübung',
  pair: 'Paar (Superset)',
  all: 'Alle Übungen zusammen',
};

export const TIMING_FAMILY_LABELS: Record<TimingFamily, string> = {
  'fixed-window-remainder': 'Festes Zeitfenster je Runde',
  'fixed-work-rest': 'Feste Belastung/Pause je Runde',
  'self-paced': 'Selbstbestimmtes Tempo',
};

export const REST_FORMULA_LABELS: Record<RestFormula, string> = {
  proportional: 'Proportional zur Satzdauer',
  fixed: 'Feste Pause',
};

export const STOP_CONDITION_LABELS: Record<StopCondition, string> = {
  'fixed-count': 'Feste Rundenzahl',
  'time-budget': 'Zeitbudget (mit Kulanz)',
  'all-exercises-done': 'Kein Timer — manuell beenden',
};
