import type { Scope } from './trainingMethods';
import type { BlockSnapshot, FinishedExercise, LoggedSet, SnapshotExercise, TrainingMethodSnapshot } from './sessionTypes';

// A "unit" is the group of exercises that belong together according to scope: one exercise (single),
// a fixed pair (pair, e.g. heavy/light) or all exercises of the block together (all).
export function computeUnits(scope: Scope, exercises: SnapshotExercise[]): SnapshotExercise[][] {
  if (scope === 'pair') {
    const units: SnapshotExercise[][] = [];
    for (let i = 0; i < exercises.length; i += 2) units.push([exercises[i], exercises[i + 1]]);
    return units;
  }
  if (scope === 'all') return exercises.length ? [exercises] : [];
  return exercises.map((ex) => [ex]);
}

// Identifies the concrete plan slot instead of the exercise_id (possibly repeated in the same
// block) -- e.g. when the same exercise appears as a "light" and a "heavy" variant in several
// superset pairs of the same block. Old sessions frozen before this extension have no
// plan_block_exercise_id and fall back to the old exercise_id behaviour.
export function slotKey(ex: { exercise_id: number; plan_block_exercise_id?: number | null }): number {
  return ex.plan_block_exercise_id ?? ex.exercise_id;
}

export function countByExercise(exercises: SnapshotExercise[], logged: LoggedSet[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const ex of exercises) counts.set(slotKey(ex), 0);
  for (const l of logged) counts.set(slotKey(l), (counts.get(slotKey(l)) ?? 0) + 1);
  return counts;
}

// With fixed-window-remainder/fixed-work-rest all members of a unit always move on one round
// together; with self-paced a "round" is one complete rotation through the unit.
// In all cases the smallest single count is the number of completed rounds.
export function unitRoundCount(unit: SnapshotExercise[], counts: Map<number, number>): number {
  return Math.min(...unit.map((ex) => counts.get(slotKey(ex)) ?? 0));
}

export function isUnitDone(
  unit: SnapshotExercise[],
  method: TrainingMethodSnapshot,
  counts: Map<number, number>,
  finishedIds: Set<number>,
): boolean {
  if (method.stop_condition === 'fixed-count') {
    return unitRoundCount(unit, counts) >= (method.rounds ?? 1);
  }
  return unit.every((ex) => finishedIds.has(slotKey(ex)));
}

export function isBlockDone(block: BlockSnapshot, logged: LoggedSet[], finishedExercises: FinishedExercise[]): boolean {
  const units = computeUnits(block.training_method.scope, block.exercises);
  if (units.length === 0) return true;
  const counts = countByExercise(block.exercises, logged);
  const finishedIds = new Set(finishedExercises.map(slotKey));
  return units.every((unit) => isUnitDone(unit, block.training_method, counts, finishedIds));
}

// For the "exercise X/Y" display in the running training: only meaningful with more than one unit
// in the block (e.g. with scope 'all' there is only one unit for the whole block anyway).
export function activeUnitPosition(
  block: BlockSnapshot,
  logged: LoggedSet[],
  finishedExercises: FinishedExercise[],
): { index: number; total: number } | null {
  const units = computeUnits(block.training_method.scope, block.exercises);
  if (units.length <= 1) return null;
  const counts = countByExercise(block.exercises, logged);
  const finishedIds = new Set(finishedExercises.map(slotKey));
  const index = units.findIndex((unit) => !isUnitDone(unit, block.training_method, counts, finishedIds));
  if (index === -1) return null;
  return { index, total: units.length };
}
