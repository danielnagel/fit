import type {
  BlockSnapshot,
  LoggedSet,
  SessionDetail,
  SnapshotExercise,
  TrainingMethodSnapshot,
} from '../../src/sessionTypes';

export function exerciseFixture(id: number, overrides: Partial<SnapshotExercise> = {}): SnapshotExercise {
  return {
    exercise_id: id,
    exercise_name: `Exercise ${id}`,
    description: null,
    reps_min: null,
    reps_max: null,
    note: null,
    is_unilateral_active: false,
    ...overrides,
  };
}

export function methodFixture(overrides: Partial<TrainingMethodSnapshot> = {}): TrainingMethodSnapshot {
  return {
    name: 'Test method',
    scope: 'single',
    timing_family: 'fixed-window-remainder',
    window_seconds: 60,
    work_seconds: null,
    rest_seconds: null,
    rest_formula: null,
    rest_factor: null,
    stop_condition: 'fixed-count',
    rounds: 3,
    total_duration_seconds: null,
    ...overrides,
  };
}

export function loggedSetFixture(exerciseId: number, unitIndex: number, overrides: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id: Math.floor(Math.random() * 1_000_000),
    exercise_id: exerciseId,
    unit_index: unitIndex,
    reps: 10,
    completed_seconds: null,
    side: null,
    performed_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function blockFixture(overrides: Partial<BlockSnapshot> = {}): BlockSnapshot {
  return { training_method: methodFixture(), exercises: [exerciseFixture(1)], ...overrides };
}

export function sessionFixture(overrides: Partial<SessionDetail> = {}): SessionDetail {
  return {
    id: 1,
    plan_week_id: 1,
    plan_day_id: 1,
    day_snapshot: { name: 'Day 1', blocks: [blockFixture()] },
    status: 'in_progress',
    started_at: '2026-01-01T00:00:00Z',
    completed_at: null,
    logged_sets: [],
    previous_logged_sets: [],
    records: [],
    finished_exercises: [],
    timer_anchors: {},
    ...overrides,
  };
}
