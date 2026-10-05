import type { BlockRunnerProps } from './sessionTypes';
import { computeUnits, countByExercise, isUnitDone, slotKey } from './blockRunnerUtils';
import CircuitUnitRunner from './CircuitUnitRunner';
import FixedWindowUnitRunner from './FixedWindowUnitRunner';
import FixedWorkRestUnitRunner from './FixedWorkRestUnitRunner';
import SelfPacedUnitRunner from './SelfPacedUnitRunner';

// Interprets the 4 dimensions of a training method at runtime instead of branching on a fixed
// type string: groups the block's exercises into units according to scope, finds the first
// unit that isn't completed yet and dispatches per timing_family to one of the generic
// runners. self-paced with more than one exercise in the unit (scope "all", the circuit)
// has a fundamentally different UI than self-paced with one exercise (scope "single", the
// ladder) -- see CircuitUnitRunner vs. SelfPacedUnitRunner.
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
