import { useEffect, useMemo, useRef, useState } from 'react';
import type { UnitRunnerProps } from './sessionTypes';
import Countdown from './Countdown';
import ExerciseInfo from './ExerciseInfo';
import { anchorElapsedSeconds, formatMmSs } from './useTimer';
import { countByExercise, unitRoundCount } from './blockRunnerUtils';

// Generalizes interval (unit = 1 exercise) and superset (unit = pair): fixed time window
// per round, reps can be entered at any time before it runs out, all members of the
// unit move on one round together.
export default function FixedWindowUnitRunner({
  unit,
  nextUnit = null,
  method,
  session,
  phaseKeyBase,
  logSet,
  setTimerAnchor,
}: UnitRunnerProps) {
  const windowSeconds = method.window_seconds ?? 180;
  const counts = useMemo(() => countByExercise(unit, session.logged_sets), [unit, session.logged_sets]);
  const round = unitRoundCount(unit, counts);
  const phaseKey = `${phaseKeyBase}-${round}`;
  const anchorElapsed = anchorElapsedSeconds(session.timer_anchors.primary, phaseKey);

  const [reps, setReps] = useState<string[]>(() => unit.map(() => ''));
  const [side, setSide] = useState<('left' | 'right')[]>(() => unit.map(() => 'left'));
  const [completedElapsed, setCompletedElapsed] = useState<number | null>(null);
  const postedAnchorRef = useRef<string | null>(anchorElapsed != null ? phaseKey : null);
  // setTimerAnchor only stores the anchor in the backend without reloading the local session --
  // session.timer_anchors.primary is therefore stale during the running round. For the
  // "set completed after" display we keep the round start locally (wall clock time),
  // initialized from the anchor only to restore after a reload.
  const roundStartRef = useRef<number>(anchorElapsed != null ? Date.now() - anchorElapsed * 1000 : Date.now());

  useEffect(() => {
    if (postedAnchorRef.current === phaseKey) return;
    postedAnchorRef.current = phaseKey;
    setTimerAnchor('primary', phaseKey, windowSeconds);
    roundStartRef.current = Date.now();
    setReps(unit.map(() => ''));
    setSide(unit.map(() => 'left'));
    setCompletedElapsed(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey]);

  const effectiveSeconds = anchorElapsed != null ? Math.max(0, windowSeconds - anchorElapsed) : windowSeconds;

  // Mark the end of the set instead of pausing the clock: the round's total time keeps running
  // normally (serves as rest until the end of the round), we only record after how many
  // seconds the set was completed -- for the live display and the history.
  const markCompleted = () => {
    setCompletedElapsed((prev) => prev ?? Math.max(0, Math.floor((Date.now() - roundStartRef.current) / 1000)));
  };

  const handleNext = async () => {
    for (let i = 0; i < unit.length; i++) {
      const repsValue = reps[i] === '' ? null : Number(reps[i]);
      if (unit[i].is_unilateral_active) {
        await logSet(unit[i].exercise_id, unit[i].plan_block_exercise_id, round, repsValue, completedElapsed, side[i]);
      } else {
        await logSet(unit[i].exercise_id, unit[i].plan_block_exercise_id, round, repsValue, completedElapsed);
      }
    }
    setReps(unit.map(() => ''));
    setSide(unit.map(() => 'left'));
    setCompletedElapsed(null);
  };

  // Preview of what the "Weiter" click actually does: for interval/superset this isn't
  // obvious -- either another round of the same exercise(s) follows, or it moves on to the
  // next exercise in the block.
  const isLastRound = round + 1 >= (method.rounds ?? 1);
  const nextStepLabel = isLastRound
    ? nextUnit
      ? `Next exercise: ${nextUnit.map((e) => e.exercise_name).join(' + ')}`
      : 'Last set in this block'
    : `Again: ${unit.map((e) => e.exercise_name).join(' + ')} (set ${round + 2}/${method.rounds})`;

  const lastCompletedSet = [...session.logged_sets]
    .reverse()
    .find((s) => unit.some((u) => u.exercise_id === s.exercise_id) && s.completed_seconds != null);

  return (
    <div className="panel-accent flex w-full flex-col items-start gap-4">
      {lastCompletedSet && (
        <p className="hint">Last set completed after {formatMmSs(lastCompletedSet.completed_seconds!)}</p>
      )}
      <form
        className="flex flex-col items-start gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleNext();
        }}
      >
        {unit.map((exercise, i) => (
          <div key={exercise.plan_block_exercise_id ?? `${exercise.exercise_id}-${i}`} className="flex flex-col gap-1.5">
            <p>
              <strong className="text-fg">{exercise.exercise_name}</strong>
              <ExerciseInfo description={exercise.description} />
              {method.stop_condition === 'fixed-count' && ` — set ${round + 1}/${method.rounds}`}
              {exercise.reps_min != null && ` (target: ${exercise.reps_min}-${exercise.reps_max} reps)`}
            </p>
            {exercise.note && <p className="hint">{exercise.note}</p>}
            <label className="flex items-center gap-2">
              Reps{' '}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={reps[i] ?? ''}
                onChange={(e) => setReps((prev) => prev.map((r, j) => (j === i ? e.target.value : r)))}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  markCompleted();
                }}
                className="field w-20"
              />
            </label>
            {exercise.is_unilateral_active && (
              <label className="flex items-center gap-2">
                Side{' '}
                <select
                  value={side[i] ?? 'left'}
                  onChange={(e) =>
                    setSide((prev) => prev.map((s, j) => (j === i ? (e.target.value as 'left' | 'right') : s)))
                  }
                  className="field w-28"
                >
                  <option value="left">left</option>
                  <option value="right">right</option>
                </select>
              </label>
            )}
          </div>
        ))}
        <Countdown
          seconds={effectiveSeconds}
          onComplete={handleNext}
          onMarkComplete={markCompleted}
          completedAfterSeconds={completedElapsed}
          key={phaseKey}
        />
        <button type="submit" className="btn-primary">
          Next
        </button>
        <p className="hint">{nextStepLabel}</p>
      </form>
    </div>
  );
}
