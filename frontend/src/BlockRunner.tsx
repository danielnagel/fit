import type { BlockRunnerProps } from './sessionTypes';
import { computeUnits, countByExercise, isUnitDone, slotKey } from './blockRunnerUtils';
import CircuitUnitRunner from './CircuitUnitRunner';
import FixedWindowUnitRunner from './FixedWindowUnitRunner';
import FixedWorkRestUnitRunner from './FixedWorkRestUnitRunner';
import SelfPacedUnitRunner from './SelfPacedUnitRunner';

// Interpretiert die 4 Dimensionen einer Trainingsmethode zur Laufzeit statt auf einen festen
// Typ-String zu verzweigen: gruppiert die Uebungen des Blocks laut scope in Einheiten, ermittelt
// die erste noch nicht abgeschlossene Einheit und dispatcht je timing_family an einen der
// generischen Runner. self-paced mit mehr als einer Uebung in der Einheit (scope "all", der
// Zirkel) hat ein grundlegend anderes UI als self-paced mit einer Uebung (scope "single", die
// Stufenleiter) -- siehe CircuitUnitRunner vs. SelfPacedUnitRunner.
export default function BlockRunner({ session, block, phaseKeyBase, logSet, finishExercise, setTimerAnchor }: BlockRunnerProps) {
  const method = block.training_method;
  const units = computeUnits(method.scope, block.exercises);
  const counts = countByExercise(block.exercises, session.logged_sets);
  const finishedIds = new Set(session.finished_exercises.map(slotKey));
  const activeUnitIndex = units.findIndex((unit) => !isUnitDone(unit, method, counts, finishedIds));

  if (activeUnitIndex === -1) return null;

  const unit = units[activeUnitIndex];
  const nextUnit = units[activeUnitIndex + 1] ?? null;
  const unitKey = `${phaseKeyBase}-u${activeUnitIndex}`;
  const unitProps = { unit, nextUnit, method, session, phaseKeyBase: unitKey, logSet, finishExercise, setTimerAnchor };

  if (method.timing_family === 'fixed-work-rest') return <FixedWorkRestUnitRunner key={unitKey} {...unitProps} />;
  if (method.timing_family === 'self-paced') {
    return unit.length > 1 ? <CircuitUnitRunner key={unitKey} {...unitProps} /> : <SelfPacedUnitRunner key={unitKey} {...unitProps} />;
  }
  return <FixedWindowUnitRunner key={unitKey} {...unitProps} />;
}
