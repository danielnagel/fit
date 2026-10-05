import { describe, expect, it } from 'vitest';
import {
  activeUnitPosition,
  computeUnits,
  countByExercise,
  isBlockDone,
  isUnitDone,
  unitRoundCount,
} from '../src/blockRunnerUtils';
import type { BlockSnapshot, FinishedExercise, LoggedSet, SnapshotExercise, TrainingMethodSnapshot } from '../src/sessionTypes';

function exercise(id: number, planBlockExerciseId?: number): SnapshotExercise {
  return {
    exercise_id: id,
    plan_block_exercise_id: planBlockExerciseId,
    exercise_name: `Exercise ${id}`,
    description: null,
    reps_min: null,
    reps_max: null,
    note: null,
    is_unilateral_active: false,
  };
}

function loggedSet(exerciseId: number, unitIndex: number, overrides: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id: Math.random(),
    exercise_id: exerciseId,
    plan_block_exercise_id: null,
    unit_index: unitIndex,
    reps: 10,
    completed_seconds: null,
    side: null,
    performed_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function finishedExercise(exerciseId: number, planBlockExerciseId: number | null = null): FinishedExercise {
  return { exercise_id: exerciseId, plan_block_exercise_id: planBlockExerciseId };
}

function method(overrides: Partial<TrainingMethodSnapshot> = {}): TrainingMethodSnapshot {
  return {
    name: 'Test',
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

describe('computeUnits', () => {
  it('splits single scope into one unit per exercise', () => {
    const units = computeUnits('single', [exercise(1), exercise(2)]);
    expect(units).toEqual([[exercise(1)], [exercise(2)]]);
  });

  it('pairs exercises for pair scope', () => {
    const units = computeUnits('pair', [exercise(1), exercise(2), exercise(3), exercise(4)]);
    expect(units).toEqual([
      [exercise(1), exercise(2)],
      [exercise(3), exercise(4)],
    ]);
  });

  it('groups all exercises into a single unit for all scope', () => {
    const units = computeUnits('all', [exercise(1), exercise(2)]);
    expect(units).toEqual([[exercise(1), exercise(2)]]);
  });

  it('returns no units for an empty exercise list regardless of scope', () => {
    expect(computeUnits('all', [])).toEqual([]);
    expect(computeUnits('single', [])).toEqual([]);
    expect(computeUnits('pair', [])).toEqual([]);
  });
});

describe('countByExercise', () => {
  it('starts every exercise at zero and counts logged sets', () => {
    const counts = countByExercise([exercise(1), exercise(2)], [loggedSet(1, 0), loggedSet(1, 1)]);
    expect(counts.get(1)).toBe(2);
    expect(counts.get(2)).toBe(0);
  });
});

describe('unitRoundCount', () => {
  it('is the minimum count across the unit members', () => {
    const counts = new Map([[1, 3], [2, 1]]);
    expect(unitRoundCount([exercise(1), exercise(2)], counts)).toBe(1);
  });
});

describe('isUnitDone', () => {
  it('is done once the round count reaches the configured rounds for fixed-count', () => {
    const m = method({ stop_condition: 'fixed-count', rounds: 2 });
    const counts = new Map([[1, 2]]);
    expect(isUnitDone([exercise(1)], m, counts, new Set())).toBe(true);
    expect(isUnitDone([exercise(1)], m, new Map([[1, 1]]), new Set())).toBe(false);
  });

  it('depends on every member being manually finished for other stop conditions', () => {
    const m = method({ stop_condition: 'all-exercises-done' });
    expect(isUnitDone([exercise(1), exercise(2)], m, new Map(), new Set([1]))).toBe(false);
    expect(isUnitDone([exercise(1), exercise(2)], m, new Map(), new Set([1, 2]))).toBe(true);
  });
});

describe('isBlockDone', () => {
  function block(overrides: Partial<BlockSnapshot> = {}): BlockSnapshot {
    return { training_method: method(), exercises: [exercise(1), exercise(2)], ...overrides };
  }

  it('is true when a block has no exercises', () => {
    expect(isBlockDone(block({ exercises: [] }), [], [])).toBe(true);
  });

  it('is false until every unit reaches its stop condition', () => {
    const b = block({ training_method: method({ stop_condition: 'fixed-count', rounds: 1 }) });
    expect(isBlockDone(b, [loggedSet(1, 0)], [])).toBe(false);
    expect(isBlockDone(b, [loggedSet(1, 0), loggedSet(2, 0)], [])).toBe(true);
  });

  it('respects pair-scope units as a whole', () => {
    const b = block({
      training_method: method({ scope: 'pair', stop_condition: 'fixed-count', rounds: 1 }),
    });
    expect(isBlockDone(b, [loggedSet(1, 0)], [])).toBe(false);
    expect(isBlockDone(b, [loggedSet(1, 0), loggedSet(2, 0)], [])).toBe(true);
  });

  // Regression for the reported bug: "Day 3 pull" interlinks the door pull (id 5) in all three
  // superset pairs. Without plan_block_exercise_id, sets from pair 1/2 were wrongly counted as
  // progress for pair 3, which was therefore already "done" before it was started.
  it('does not let an exercise reused across pairs falsely finish a later pair', () => {
    const b = block({
      training_method: method({ scope: 'pair', stop_condition: 'fixed-count', rounds: 2 }),
      exercises: [
        exercise(16, 282), // pull-up
        exercise(5, 283), // door pull (pair 1)
        exercise(5, 284), // door pull (pair 2)
        exercise(3, 285), // inverted row (pair 2)
        exercise(3, 286), // inverted row (pair 3)
        exercise(5, 287), // door pull (pair 3)
      ],
    });
    // Pair 1 (pull-up/door pull-283) and pair 2 (door pull-284/inverted row-285) fully logged with
    // 2 rounds each -- pair 3 was never done.
    const logged = [
      loggedSet(16, 0, { plan_block_exercise_id: 282 }),
      loggedSet(5, 0, { plan_block_exercise_id: 283 }),
      loggedSet(16, 1, { plan_block_exercise_id: 282 }),
      loggedSet(5, 1, { plan_block_exercise_id: 283 }),
      loggedSet(5, 0, { plan_block_exercise_id: 284 }),
      loggedSet(3, 0, { plan_block_exercise_id: 285 }),
      loggedSet(5, 1, { plan_block_exercise_id: 284 }),
      loggedSet(3, 1, { plan_block_exercise_id: 285 }),
    ];
    expect(isBlockDone(b, logged, [])).toBe(false);

    const units = computeUnits(b.training_method.scope, b.exercises);
    const counts = countByExercise(b.exercises, logged);
    const finishedIds = new Set<number>();
    const activeUnitIndex = units.findIndex((unit) => !isUnitDone(unit, b.training_method, counts, finishedIds));
    expect(activeUnitIndex).toBe(2);
  });

  // Same bug as above, but for the "finish manually" path (all-exercises-done): the same
  // exercise appears in the block as two variants (only distinguished by the note in the plan slot).
  // Finishing the first variant must not automatically complete the second one as well.
  it('does not let finishing one slot of a reused exercise finish another slot (all-exercises-done)', () => {
    const b = block({
      training_method: method({ scope: 'single', stop_condition: 'all-exercises-done' }),
      exercises: [exercise(5, 283), exercise(5, 287)], // door pull light / heavy
    });

    expect(isBlockDone(b, [], [finishedExercise(5, 283)])).toBe(false);
    expect(isBlockDone(b, [], [finishedExercise(5, 283), finishedExercise(5, 287)])).toBe(true);
  });
});

describe('activeUnitPosition', () => {
  function block(overrides: Partial<BlockSnapshot> = {}): BlockSnapshot {
    return { training_method: method(), exercises: [exercise(1), exercise(2), exercise(3), exercise(4)], ...overrides };
  }

  it('is null when the block has only a single unit (e.g. scope "all")', () => {
    const b = block({ training_method: method({ scope: 'all' }) });
    expect(activeUnitPosition(b, [], [])).toBeNull();
  });

  it('reports the index of the currently active unit among all units', () => {
    const b = block({ training_method: method({ scope: 'single', stop_condition: 'fixed-count', rounds: 1 }) });
    expect(activeUnitPosition(b, [], [])).toEqual({ index: 0, total: 4 });
    expect(activeUnitPosition(b, [loggedSet(1, 0), loggedSet(2, 0)], [])).toEqual({ index: 2, total: 4 });
  });

  it('is null once every unit in the block is done', () => {
    const b = block({
      training_method: method({ scope: 'single', stop_condition: 'fixed-count', rounds: 1 }),
      exercises: [exercise(1), exercise(2)],
    });
    expect(activeUnitPosition(b, [loggedSet(1, 0), loggedSet(2, 0)], [])).toBeNull();
  });
});
