import { useEffect, useMemo, useRef, useState } from 'react';
import type { UnitRunnerProps } from './sessionTypes';
import Countdown from './Countdown';
import ExerciseInfo from './ExerciseInfo';
import { anchorElapsedSeconds, formatMmSs } from './useTimer';
import { countByExercise, unitRoundCount } from './blockRunnerUtils';

// Generalisiert Interval (Einheit = 1 Uebung) und Superset (Einheit = Paar): festes Zeitfenster
// je Runde, Wiederholungen koennen jederzeit vor Ablauf eingetragen werden, alle Mitglieder der
// Einheit rücken gemeinsam eine Runde weiter.
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
  // setTimerAnchor speichert den Anker nur im Backend, ohne die lokale Session neu zu laden --
  // session.timer_anchors.primary ist waehrend der laufenden Runde daher veraltet. Fuer die
  // "Satz abgeschlossen nach"-Anzeige merken wir uns den Rundenstart deshalb lokal (Wanduhrzeit),
  // initial aus dem Anker nur zur Wiederherstellung nach einem Reload.
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

  // Satzende markieren statt die Laufzeit zu pausieren: die Gesamtzeit der Runde laeuft normal
  // weiter (dient als Pause bis zum Rundenende), es wird nur festgehalten, nach wie vielen
  // Sekunden der Satz abgeschlossen wurde -- fuer die Live-Anzeige und die Historie.
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

  // Vorschau, was der "Weiter"-Klick tatsaechlich bewirkt: bei Interval/Supersatz ist das nicht
  // offensichtlich -- entweder laeuft noch eine Runde derselben Uebung(en), oder es geht zur
  // naechsten Uebung im Block weiter.
  const isLastRound = round + 1 >= (method.rounds ?? 1);
  const nextStepLabel = isLastRound
    ? nextUnit
      ? `Nächste Übung: ${nextUnit.map((e) => e.exercise_name).join(' + ')}`
      : 'Letzter Satz in diesem Block'
    : `Nochmal: ${unit.map((e) => e.exercise_name).join(' + ')} (Satz ${round + 2}/${method.rounds})`;

  const lastCompletedSet = [...session.logged_sets]
    .reverse()
    .find((s) => unit.some((u) => u.exercise_id === s.exercise_id) && s.completed_seconds != null);

  return (
    <div className="panel-accent flex w-full flex-col items-start gap-4">
      {lastCompletedSet && (
        <p className="hint">Letzter Satz nach {formatMmSs(lastCompletedSet.completed_seconds!)} abgeschlossen</p>
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
              {method.stop_condition === 'fixed-count' && ` — Satz ${round + 1}/${method.rounds}`}
              {exercise.reps_min != null && ` (Ziel: ${exercise.reps_min}-${exercise.reps_max} Wdh.)`}
            </p>
            {exercise.note && <p className="hint">{exercise.note}</p>}
            <label className="flex items-center gap-2">
              Wiederholungen{' '}
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
        ))}
        <Countdown
          seconds={effectiveSeconds}
          onComplete={handleNext}
          onMarkComplete={markCompleted}
          completedAfterSeconds={completedElapsed}
          key={phaseKey}
        />
        <button type="submit" className="btn-primary">
          Weiter
        </button>
        <p className="hint">{nextStepLabel}</p>
      </form>
    </div>
  );
}
