import { useEffect, useMemo, useRef, useState } from 'react';
import type { UnitRunnerProps } from './sessionTypes';
import Countdown from './Countdown';
import ExerciseInfo from './ExerciseInfo';
import { anchorElapsedSeconds, useStopwatch, formatMmSs } from './useTimer';
import { countByExercise, slotKey } from './blockRunnerUtils';

type RestState = { key: string; seconds: number };

// Ladder (unit = 1 exercise, self-paced): stopwatch during the set, enter reps at the end of
// the set, then rest according to rest_formula. In line with the stop condition there's no
// automatic round counter; the unit only ends when "Finish exercise" is pressed (the time
// budget only shows a grace remaining time). For the circuit (unit = all exercises) see
// CircuitUnitRunner instead -- it has a fundamentally different UI (no reps entry, manual
// round counter instead of automatic rotation).
export default function SelfPacedUnitRunner({
  unit,
  method,
  session,
  phaseKeyBase,
  logSet,
  finishExercise,
  setTimerAnchor,
}: UnitRunnerProps) {
  const counts = useMemo(() => countByExercise(unit, session.logged_sets), [unit, session.logged_sets]);
  const exercise = unit[0];
  const step = counts.get(slotKey(exercise)) ?? 0;

  const primaryAnchor = session.timer_anchors.primary;
  const secondaryAnchor = session.timer_anchors.secondary;
  const workPhaseKey = `${phaseKeyBase}-work-${exercise.exercise_id}-${step}`;
  const budgetPhaseKey = `${phaseKeyBase}-budget`;
  const budgetSeconds = method.total_duration_seconds ?? 0;
  const showBudget = method.stop_condition === 'time-budget';

  const resumingRestKeyMatch =
    primaryAnchor && primaryAnchor.phase_key.startsWith(`${phaseKeyBase}-rest-`) ? primaryAnchor : null;
  const [restState, setRestState] = useState<RestState | null>(() =>
    resumingRestKeyMatch ? { key: resumingRestKeyMatch.phase_key, seconds: resumingRestKeyMatch.duration_seconds } : null,
  );
  const [reps, setReps] = useState('');
  const [side, setSide] = useState<'left' | 'right'>('left');
  const phase: 'work' | 'rest' = restState ? 'rest' : 'work';

  const stopwatch = useStopwatch(anchorElapsedSeconds(primaryAnchor, workPhaseKey) ?? 0);
  const budgetTimer = useStopwatch(anchorElapsedSeconds(secondaryAnchor, budgetPhaseKey) ?? 0);

  const postedWorkAnchorRef = useRef<string | null>(null);
  const postedRestAnchorRef = useRef<string | null>(null);
  const postedBudgetAnchorRef = useRef<string | null>(null);
  const repsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase !== 'work' || postedWorkAnchorRef.current === workPhaseKey) return;
    postedWorkAnchorRef.current = workPhaseKey;
    const resumedElapsed = anchorElapsedSeconds(primaryAnchor, workPhaseKey);
    stopwatch.start(resumedElapsed ?? 0);
    if (resumedElapsed == null) setTimerAnchor('primary', workPhaseKey, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, workPhaseKey]);

  useEffect(() => {
    if (!restState || postedRestAnchorRef.current === restState.key) return;
    postedRestAnchorRef.current = restState.key;
    if (anchorElapsedSeconds(primaryAnchor, restState.key) == null) {
      setTimerAnchor('primary', restState.key, restState.seconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restState]);

  useEffect(() => {
    if (postedBudgetAnchorRef.current === budgetPhaseKey) return;
    postedBudgetAnchorRef.current = budgetPhaseKey;
    const resumedElapsed = anchorElapsedSeconds(secondaryAnchor, budgetPhaseKey);
    budgetTimer.start(resumedElapsed ?? 0);
    if (resumedElapsed == null) setTimerAnchor('secondary', budgetPhaseKey, budgetSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'work') repsInputRef.current?.focus();
  }, [phase, workPhaseKey]);

  const remaining = Math.max(0, budgetSeconds - budgetTimer.elapsed);
  const lastLoggedSet = session.logged_sets.filter((l) => l.exercise_id === exercise.exercise_id).slice(-1)[0];
  const record = session.records.find((r) => r.exercise_id === exercise.exercise_id);
  const canFinishStep = reps.trim() !== '';
  const restElapsedFromAnchor = restState ? anchorElapsedSeconds(primaryAnchor, restState.key) ?? 0 : 0;
  const effectiveRestSeconds = restState ? Math.max(0, restState.seconds - restElapsedFromAnchor) : 0;

  const restSecondsFor = (elapsed: number) => {
    if (method.rest_formula === 'fixed') return Math.max(0, method.rest_seconds ?? 0);
    return Math.max(1, Math.round(elapsed * (method.rest_factor ?? 1)));
  };

  // Preview of what comes after the current set: the same exercise with the next higher step.
  const nextStepLabel = `Next step after the rest: step ${step + 2}`;

  const finishStep = async () => {
    if (!canFinishStep) return;
    const elapsed = stopwatch.elapsed;
    stopwatch.stop();
    if (exercise.is_unilateral_active) {
      await logSet(exercise.exercise_id, exercise.plan_block_exercise_id, step, Number(reps), undefined, side);
    } else {
      await logSet(exercise.exercise_id, exercise.plan_block_exercise_id, step, Number(reps));
    }
    setReps('');
    setSide('left');
    setRestState({ key: `${phaseKeyBase}-rest-${exercise.exercise_id}-${step}`, seconds: restSecondsFor(elapsed) });
  };

  const finishUnit = async () => {
    stopwatch.stop();
    budgetTimer.stop();
    setRestState(null);
    await finishExercise(exercise.exercise_id, exercise.plan_block_exercise_id);
  };

  return (
    <div className="panel-accent flex w-full flex-col items-start gap-3">
      <p>
        <strong className="text-fg">{exercise.exercise_name}</strong>
        <ExerciseInfo description={exercise.description} /> — step {step + 1}
      </p>
      {exercise.note && <p className="hint">{exercise.note}</p>}
      {lastLoggedSet && <p className="hint">Last set: {lastLoggedSet.reps ?? '–'} reps</p>}
      {record && (
        <p className="hint">
          Personal best so far: step {record.max_stage + 1}
          {record.best_reps != null && `, most reps ${record.best_reps}`}
        </p>
      )}
      {showBudget && (
        <p className="hint">
          Time budget left: {formatMmSs(remaining)}
          {remaining <= 0 && ' (expired — the current unit may still be finished)'}
        </p>
      )}

      {phase === 'work' ? (
        <>
          <p className="text-lg font-semibold tabular-nums text-accent">Work time: {formatMmSs(stopwatch.elapsed)}</p>
          <form
            className="flex flex-wrap items-center gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              finishStep();
            }}
          >
            <label className="flex items-center gap-2">
              Reps{' '}
              <input
                ref={repsInputRef}
                type="number"
                inputMode="numeric"
                min={0}
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className="field w-20"
              />
            </label>
            {exercise.is_unilateral_active && (
              <label className="flex items-center gap-2">
                Side{' '}
                <select value={side} onChange={(e) => setSide(e.target.value as 'left' | 'right')} className="field w-28">
                  <option value="left">left</option>
                  <option value="right">right</option>
                </select>
              </label>
            )}
            <button type="submit" className="btn-primary" disabled={!canFinishStep}>
              Set done
            </button>
          </form>
          <p className="hint">{nextStepLabel}</p>
        </>
      ) : (
        <p className="flex items-center gap-2">
          Rest{' '}
          <Countdown
            seconds={effectiveRestSeconds}
            onComplete={() => setRestState(null)}
            skipLabel="Skip rest"
            key={restState!.key}
          />
        </p>
      )}
      <button type="button" className="btn" onClick={finishUnit}>
        Finish exercise
      </button>
    </div>
  );
}
