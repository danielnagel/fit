import type { TrainingMethod } from './trainingMethods';
import type { TimerAnchor } from './useTimer';

export type SnapshotExercise = {
  exercise_id: number;
  // Identifies the concrete plan entry (slot) within the block -- unlike
  // exercise_id, which can repeat when the same exercise appears in several pairs of the same
  // block (e.g. "light"/"heavy" variants). Old sessions (frozen before this
  // extension) lack the field -- see blockRunnerUtils for the fallback.
  plan_block_exercise_id?: number;
  exercise_name: string;
  description: string | null;
  reps_min: number | null;
  reps_max: number | null;
  note: string | null;
  is_unilateral_active: boolean;
};

export type TrainingMethodSnapshot = Omit<TrainingMethod, 'id'>;

export type BlockSnapshot = {
  training_method: TrainingMethodSnapshot;
  exercises: SnapshotExercise[];
};

export type DaySnapshot = {
  name: string;
  blocks: BlockSnapshot[];
};

export type LoggedSet = {
  id: number;
  exercise_id: number;
  plan_block_exercise_id?: number | null;
  unit_index: number;
  reps: number | null;
  completed_seconds: number | null;
  side: 'left' | 'right' | null;
  performed_at: string;
};
export type PreviousLoggedSet = { exercise_id: number; unit_index: number; reps: number | null };
export type StageRecord = { exercise_id: number; max_stage: number; best_reps: number | null };
export type FinishedExercise = { exercise_id: number; plan_block_exercise_id: number | null };
export type TimerSlot = 'primary' | 'secondary';

export type SessionDetail = {
  id: number;
  plan_week_id: number;
  plan_day_id: number | null;
  day_snapshot: DaySnapshot;
  status: string;
  started_at: string;
  completed_at: string | null;
  logged_sets: LoggedSet[];
  previous_logged_sets: PreviousLoggedSet[];
  records: StageRecord[];
  finished_exercises: FinishedExercise[];
  timer_anchors: Partial<Record<TimerSlot, TimerAnchor>>;
};

export type LogSetFn = (
  exerciseId: number,
  planBlockExerciseId: number | undefined,
  unitIndex: number,
  reps: number | null,
  completedSeconds?: number | null,
  side?: 'left' | 'right' | null,
) => Promise<void>;

export type BlockRunnerProps = {
  session: SessionDetail;
  block: BlockSnapshot;
  phaseKeyBase: string;
  logSet: LogSetFn;
  finishExercise: (exerciseId: number, planBlockExerciseId: number | undefined) => Promise<void>;
  setTimerAnchor: (slot: TimerSlot, phaseKey: string, durationSeconds: number) => void;
};

export type UnitRunnerProps = {
  unit: SnapshotExercise[];
  nextUnit?: SnapshotExercise[] | null;
  method: TrainingMethodSnapshot;
  session: SessionDetail;
  phaseKeyBase: string;
  logSet: LogSetFn;
  finishExercise: (exerciseId: number, planBlockExerciseId: number | undefined) => Promise<void>;
  setTimerAnchor: (slot: TimerSlot, phaseKey: string, durationSeconds: number) => void;
};
