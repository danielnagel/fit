import { useEffect, useRef } from 'react';
import type { UnitRunnerProps } from './sessionTypes';
import ExerciseInfo from './ExerciseInfo';
import TapCounter from './TapCounter';
import { anchorElapsedSeconds, useStopwatch, formatMmSs } from './useTimer';
import { countByExercise, slotKey, unitRoundCount } from './blockRunnerUtils';

// Circuit (scope "all", self-paced): no reps to enter -- they're already given per exercise
// by reps_min/reps_max. You go through all listed exercises once and count the round up
// manually afterwards; the focus is on the total time, not a timer per set or automatic
// rests. Once the time budget is used up, the unit ends automatically.
export default function CircuitUnitRunner({ unit, method, session, phaseKeyBase, logSet, finishExercise, setTimerAnchor }: UnitRunnerProps) {
  const counts = countByExercise(unit, session.logged_sets);
  const round = unitRoundCount(unit, counts);
  const budgetSeconds = method.total_duration_seconds ?? 0;
  const budgetPhaseKey = `${phaseKeyBase}-budget`;

  const budgetTimer = useStopwatch(anchorElapsedSeconds(session.timer_anchors.secondary, budgetPhaseKey) ?? 0);
  const postedBudgetAnchorRef = useRef<string | null>(null);
  const autoFinishedRef = useRef(false);

  useEffect(() => {
    if (postedBudgetAnchorRef.current === budgetPhaseKey) return;
    postedBudgetAnchorRef.current = budgetPhaseKey;
    const resumedElapsed = anchorElapsedSeconds(session.timer_anchors.secondary, budgetPhaseKey);
    budgetTimer.start(resumedElapsed ?? 0);
    if (resumedElapsed == null) setTimerAnchor('secondary', budgetPhaseKey, budgetSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishUnit = async () => {
    budgetTimer.stop();
    for (const member of unit) {
      await finishExercise(member.exercise_id, member.plan_block_exercise_id);
    }
  };

  const remaining = budgetSeconds - budgetTimer.elapsed;

  useEffect(() => {
    if (remaining > 0 || autoFinishedRef.current) return;
    autoFinishedRef.current = true;
    finishUnit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // Round times are logged as completed_seconds on every exercise of the round (reps stays
  // empty, see above) so the list survives a reload instead of only living in component state.
  const roundTimes: number[] = [];
  for (let r = 0; r < round; r++) {
    const entry = session.logged_sets.find((l) => l.unit_index === r && unit.some((ex) => slotKey(ex) === slotKey(l)));
    roundTimes.push(entry?.completed_seconds ?? 0);
  }
  const previousRoundsTotal = roundTimes.reduce((sum, s) => sum + s, 0);

  const finishRound = async () => {
    const roundSeconds = Math.max(0, budgetTimer.elapsed - previousRoundsTotal);
    for (const exercise of unit) {
      await logSet(exercise.exercise_id, exercise.plan_block_exercise_id, round, null, roundSeconds);
    }
  };

  return (
    <div className="panel-accent flex w-full flex-col items-start gap-3">
      <ul className="flex flex-col gap-1.5">
        {unit.map((exercise) => (
          <li key={exercise.plan_block_exercise_id ?? exercise.exercise_id}>
            <strong className="text-fg">{exercise.exercise_name}</strong>
            <ExerciseInfo description={exercise.description} />
            {exercise.reps_min != null && ` — ${exercise.reps_min}-${exercise.reps_max} reps`}
            {exercise.note && <span className="hint"> ({exercise.note})</span>}
          </li>
        ))}
      </ul>
      <p className="text-lg font-semibold tabular-nums text-accent">Total time: {formatMmSs(budgetTimer.elapsed)}</p>
      {budgetSeconds > 0 && (
        <p className="hint">
          Time budget left: {formatMmSs(Math.max(0, remaining))}
          {remaining <= 0 && ' (expired — circuit is being finished)'}
        </p>
      )}
      <TapCounter label="Rounds" count={round} onIncrement={finishRound} />
      {roundTimes.length > 0 && (
        <ul className="hint flex flex-col">
          {roundTimes.map((seconds, i) => (
            <li key={i}>
              Round {i + 1}: {formatMmSs(seconds)}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn" onClick={finishUnit}>
        Finish circuit
      </button>
    </div>
  );
}
