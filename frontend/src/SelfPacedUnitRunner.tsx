import { useEffect, useMemo, useRef, useState } from 'react';
import type { UnitRunnerProps } from './sessionTypes';
import Countdown from './Countdown';
import ExerciseInfo from './ExerciseInfo';
import { anchorElapsedSeconds, useStopwatch, formatMmSs } from './useTimer';
import { countByExercise, slotKey } from './blockRunnerUtils';

type RestState = { key: string; seconds: number };

// Ladder (Einheit = 1 Uebung, self-paced): Stoppuhr waehrend des Satzes, Wiederholungen beim
// Satzende eintragen, danach Pause nach rest_formula. Der Stop-Bedingung entsprechend gibt es
// keinen automatischen Rundenzaehler; die Einheit endet erst, wenn "Übung beenden" gedrückt wird
// (Zeitbudget zeigt nur eine Kulanz-Restzeit an). Fuer den Zirkel (Einheit = alle Uebungen) siehe
// stattdessen CircuitUnitRunner -- der hat ein grundlegend anderes UI (kein Reps-Eintrag, manueller
// Rundenzaehler statt automatischer Rotation).
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

  // Vorschau, was nach dem aktuellen Satz kommt: dieselbe Uebung mit der naechsthoeheren Stufe.
  const nextStepLabel = `Nächste Stufe nach der Pause: Stufe ${step + 2}`;

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
        <ExerciseInfo description={exercise.description} /> — Stufe {step + 1}
      </p>
      {exercise.note && <p className="hint">{exercise.note}</p>}
      {lastLoggedSet && <p className="hint">Letzter Satz: {lastLoggedSet.reps ?? '–'} Wiederholungen</p>}
      {record && (
        <p className="hint">
          Bisherige Bestleistung: Stufe {record.max_stage + 1}
          {record.best_reps != null && `, meiste Wiederholungen ${record.best_reps}`}
        </p>
      )}
      {showBudget && (
        <p className="hint">
          Zeitbudget verbleibend: {formatMmSs(remaining)}
          {remaining <= 0 && ' (abgelaufen — aktuelle Einheit darf noch beendet werden)'}
        </p>
      )}

      {phase === 'work' ? (
        <>
          <p className="text-lg font-semibold tabular-nums text-accent">Arbeitszeit: {formatMmSs(stopwatch.elapsed)}</p>
          <form
            className="flex flex-wrap items-center gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              finishStep();
            }}
          >
            <label className="flex items-center gap-2">
              Wiederholungen{' '}
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
                Seite{' '}
                <select value={side} onChange={(e) => setSide(e.target.value as 'left' | 'right')} className="field w-28">
                  <option value="left">links</option>
                  <option value="right">rechts</option>
                </select>
              </label>
            )}
            <button type="submit" className="btn-primary" disabled={!canFinishStep}>
              Satz fertig
            </button>
          </form>
          <p className="hint">{nextStepLabel}</p>
        </>
      ) : (
        <p className="flex items-center gap-2">
          Pause{' '}
          <Countdown
            seconds={effectiveRestSeconds}
            onComplete={() => setRestState(null)}
            skipLabel="Pause abbrechen"
            key={restState!.key}
          />
        </p>
      )}
      <button type="button" className="btn" onClick={finishUnit}>
        Übung beenden
      </button>
    </div>
  );
}
