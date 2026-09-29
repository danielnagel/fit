import type { Scope } from './trainingMethods';
import type { BlockSnapshot, FinishedExercise, LoggedSet, SnapshotExercise, TrainingMethodSnapshot } from './sessionTypes';

// Eine "Einheit" ist die Gruppe Uebungen, die laut scope zusammengehoeren: eine Uebung (single),
// ein festes Paar (pair, z. B. schwer/leicht) oder alle Uebungen des Blocks zusammen (all).
export function computeUnits(scope: Scope, exercises: SnapshotExercise[]): SnapshotExercise[][] {
  if (scope === 'pair') {
    const units: SnapshotExercise[][] = [];
    for (let i = 0; i < exercises.length; i += 2) units.push([exercises[i], exercises[i + 1]]);
    return units;
  }
  if (scope === 'all') return exercises.length ? [exercises] : [];
  return exercises.map((ex) => [ex]);
}

// Identifiziert den konkreten Plan-Slot statt der (moeglicherweise im selben Block wiederholten)
// exercise_id -- z.B. wenn dieselbe Uebung als "leicht"- und "schwer"-Variante in mehreren
// Supersatz-Paaren desselben Blocks auftaucht. Alte, vor dieser Erweiterung eingefrorene
// Sessions haben kein plan_block_exercise_id und fallen auf das alte exercise_id-Verhalten zurueck.
export function slotKey(ex: { exercise_id: number; plan_block_exercise_id?: number | null }): number {
  return ex.plan_block_exercise_id ?? ex.exercise_id;
}

export function countByExercise(exercises: SnapshotExercise[], logged: LoggedSet[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const ex of exercises) counts.set(slotKey(ex), 0);
  for (const l of logged) counts.set(slotKey(l), (counts.get(slotKey(l)) ?? 0) + 1);
  return counts;
}

// Alle Mitglieder einer Einheit ruecken bei fixed-window-remainder/fixed-work-rest immer gemeinsam
// eine Runde weiter; bei self-paced entspricht eine "Runde" einer vollstaendigen Rotation durch die
// Einheit. In allen Faellen ist die kleinste Einzel-Zaehlung die Anzahl abgeschlossener Runden.
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

// Fuer die "Uebung X/Y"-Anzeige im laufenden Training: nur bei mehr als einer Einheit im Block
// aussagekraeftig (z.B. bei scope 'all' gibt es ohnehin nur eine Einheit fuer den ganzen Block).
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
