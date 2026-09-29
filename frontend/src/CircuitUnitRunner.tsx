import { useEffect, useRef } from 'react';
import type { UnitRunnerProps } from './sessionTypes';
import ExerciseInfo from './ExerciseInfo';
import TapCounter from './TapCounter';
import { anchorElapsedSeconds, useStopwatch, formatMmSs } from './useTimer';
import { countByExercise, slotKey, unitRoundCount } from './blockRunnerUtils';

// Zirkel (scope "all", self-paced): keine Wiederholungen eintragen -- die sind je Uebung schon
// durch reps_min/reps_max vorgegeben. Man macht alle gelisteten Uebungen einmal durch und zaehlt
// die Runde danach manuell hoch; im Fokus steht die Gesamtzeit, nicht ein Timer je Satz oder
// automatische Pausen. Nach Ablauf des Zeitbudgets wird die Einheit automatisch beendet.
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

  // Rundenzeiten werden als completed_seconds auf jeder Uebung der Runde geloggt (reps bleibt
  // leer, siehe oben), damit die Liste einen Reload uebersteht statt nur im Komponenten-State zu leben.
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
            {exercise.reps_min != null && ` — ${exercise.reps_min}-${exercise.reps_max} Wdh.`}
            {exercise.note && <span className="hint"> ({exercise.note})</span>}
          </li>
        ))}
      </ul>
      <p className="text-lg font-semibold tabular-nums text-accent">Gesamtzeit: {formatMmSs(budgetTimer.elapsed)}</p>
      {budgetSeconds > 0 && (
        <p className="hint">
          Zeitbudget verbleibend: {formatMmSs(Math.max(0, remaining))}
          {remaining <= 0 && ' (abgelaufen — Zirkel wird beendet)'}
        </p>
      )}
      <TapCounter label="Runden" count={round} onIncrement={finishRound} />
      {roundTimes.length > 0 && (
        <ul className="hint flex flex-col">
          {roundTimes.map((seconds, i) => (
            <li key={i}>
              Runde {i + 1}: {formatMmSs(seconds)}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn" onClick={finishUnit}>
        Zirkel beenden
      </button>
    </div>
  );
}
