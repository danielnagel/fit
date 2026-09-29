import { useEffect, useMemo, useRef, useState } from 'react';
import type { UnitRunnerProps } from './sessionTypes';
import Countdown from './Countdown';
import ExerciseInfo from './ExerciseInfo';
import TapCounter from './TapCounter';
import { anchorElapsedSeconds } from './useTimer';
import { countByExercise, unitRoundCount } from './blockRunnerUtils';

// Generalisiert HIIT: fester Wechsel aus Belastung/Pause je Runde (Dauer ist vorgegeben, nicht
// selbstbestimmt). Die Wiederholungen bleiben ueber Belastung und Pause hinweg editierbar und
// werden erst am Ende der Pause geloggt, siehe finishRest.
export default function FixedWorkRestUnitRunner({ unit, method, session, phaseKeyBase, logSet, setTimerAnchor }: UnitRunnerProps) {
  const workSeconds = method.work_seconds ?? 20;
  const restSeconds = method.rest_seconds ?? 10;
  const counts = useMemo(() => countByExercise(unit, session.logged_sets), [unit, session.logged_sets]);
  const round = unitRoundCount(unit, counts);
  const workPhaseKey = `${phaseKeyBase}-work-${round}`;
  const restPhaseKey = `${phaseKeyBase}-rest-${round}`;

  const primaryAnchor = session.timer_anchors.primary;
  const resumingRest = primaryAnchor?.phase_key === restPhaseKey;
  const [phase, setPhase] = useState<'work' | 'rest'>(() => (resumingRest ? 'rest' : 'work'));
  const [reps, setReps] = useState<number[]>(() => unit.map(() => 0));
  const [side, setSide] = useState<('left' | 'right')[]>(() => unit.map(() => 'left'));
  const postedAnchorRef = useRef<string | null>(resumingRest ? restPhaseKey : null);

  useEffect(() => {
    const activeKey = phase === 'work' ? workPhaseKey : restPhaseKey;
    if (postedAnchorRef.current === activeKey) return;
    postedAnchorRef.current = activeKey;
    setTimerAnchor('primary', activeKey, phase === 'work' ? workSeconds : restSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, workPhaseKey, restPhaseKey]);

  const activeKey = phase === 'work' ? workPhaseKey : restPhaseKey;
  const anchorElapsed = anchorElapsedSeconds(primaryAnchor, activeKey);
  const activeDuration = phase === 'work' ? workSeconds : restSeconds;
  const effectiveSeconds = anchorElapsed != null ? Math.max(0, activeDuration - anchorElapsed) : activeDuration;

  // Die Wiederholungen werden erst am Ende der Pause geloggt: waehrend der Belastung fehlt die
  // Zeit zum Eintippen, erst in der Pause hat man wirklich die Hand frei dafuer. Dadurch bleibt
  // die Pause auch nach der letzten Runde bestehen, statt dass isUnitDone sofort beim Loggen am
  // Ende der Belastung zur naechsten Uebung springt.
  const finishWork = () => {
    setPhase('rest');
  };

  const finishRest = async () => {
    for (let i = 0; i < unit.length; i++) {
      if (unit[i].is_unilateral_active) {
        await logSet(unit[i].exercise_id, unit[i].plan_block_exercise_id, round, reps[i], undefined, side[i]);
      } else {
        await logSet(unit[i].exercise_id, unit[i].plan_block_exercise_id, round, reps[i]);
      }
    }
    setReps(unit.map(() => 0));
    setSide(unit.map(() => 'left'));
    setPhase('work');
  };

  return (
    <div className="panel-accent flex w-full flex-col items-start gap-4">
      <p className="text-lg font-semibold text-accent">{phase === 'work' ? 'Belastung' : 'Pause'}</p>
      {unit.map((exercise, i) => {
        const previousReps = session.previous_logged_sets.find(
          (p) => p.exercise_id === exercise.exercise_id && p.unit_index === round,
        )?.reps;
        const lastOwnSet = [...session.logged_sets].reverse().find((s) => s.exercise_id === exercise.exercise_id);
        return (
          <div key={exercise.plan_block_exercise_id ?? `${exercise.exercise_id}-${i}`} className="flex flex-col gap-1.5">
            <p>
              <strong className="text-fg">{exercise.exercise_name}</strong>
              <ExerciseInfo description={exercise.description} />
              {method.stop_condition === 'fixed-count' && ` — Runde ${round + 1}/${method.rounds}`}
            </p>
            {exercise.note && <p className="hint">{exercise.note}</p>}
            {lastOwnSet != null && <p className="hint">Letzte Runde: {lastOwnSet.reps ?? '–'} Wdh.</p>}
            {previousReps != null && <p className="hint">Letztes Mal: {previousReps} Wdh.</p>}
            <TapCounter
              label="Wiederholungen"
              count={reps[i] ?? 0}
              onIncrement={() => setReps((prev) => prev.map((r, j) => (j === i ? r + 1 : r)))}
              onDecrement={() => setReps((prev) => prev.map((r, j) => (j === i ? Math.max(0, r - 1) : r)))}
              muted={phase === 'work'}
            />
            {exercise.is_unilateral_active && (
              <label className="flex items-center gap-2">
                Seite{' '}
                <select
                  value={side[i] ?? 'left'}
                  onChange={(e) =>
                    setSide((prev) => prev.map((s, j) => (j === i ? (e.target.value as 'left' | 'right') : s)))
                  }
                  className="field w-28"
                >
                  <option value="left">links</option>
                  <option value="right">rechts</option>
                </select>
              </label>
            )}
          </div>
        );
      })}
      {phase === 'work' ? (
        <Countdown seconds={effectiveSeconds} onComplete={finishWork} key={workPhaseKey} />
      ) : (
        <Countdown seconds={effectiveSeconds} onComplete={finishRest} key={restPhaseKey} />
      )}
    </div>
  );
}
