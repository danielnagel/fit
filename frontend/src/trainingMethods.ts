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
  single: 'Single exercise',
  pair: 'Pair (superset)',
  all: 'All exercises together',
};

export const TIMING_FAMILY_LABELS: Record<TimingFamily, string> = {
  'fixed-window-remainder': 'Fixed time window per round',
  'fixed-work-rest': 'Fixed work/rest per round',
  'self-paced': 'Self-paced',
};

export const REST_FORMULA_LABELS: Record<RestFormula, string> = {
  proportional: 'Proportional to set duration',
  fixed: 'Fixed rest',
};

export const STOP_CONDITION_LABELS: Record<StopCondition, string> = {
  'fixed-count': 'Fixed number of rounds',
  'time-budget': 'Time budget (with grace)',
  'all-exercises-done': 'No timer — finish manually',
};
