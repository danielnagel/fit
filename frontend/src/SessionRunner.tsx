import { useEffect, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import type { ConfirmDialogHandle } from './ConfirmDialog';
import BlockRunner from './BlockRunner';
import { activeUnitPosition, isBlockDone } from './blockRunnerUtils';
import type { SessionDetail, TimerSlot } from './sessionTypes';
import { apiFetch } from './api';

export type {
  SnapshotExercise,
  TrainingMethodSnapshot,
  BlockSnapshot,
  DaySnapshot,
  LoggedSet,
  PreviousLoggedSet,
  StageRecord,
  TimerSlot,
  SessionDetail,
} from './sessionTypes';

type Props = {
  sessionId: number;
  onFinished: () => void;
};

export default function SessionRunner({ sessionId, onFinished }: Props) {
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortDialogRef = useRef<ConfirmDialogHandle>(null);

  const load = () => {
    apiFetch(`/api/sessions/${sessionId}`)
      .then((res) => res.json())
      .then(setSession)
      .catch((err) => setError(String(err)));
  };

  useEffect(load, [sessionId]);

  const logSet = async (
    exerciseId: number,
    planBlockExerciseId: number | undefined,
    unitIndex: number,
    reps: number | null,
    completedSeconds?: number | null,
    side?: 'left' | 'right' | null,
  ) => {
    await apiFetch(`/api/sessions/${sessionId}/logged-sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exercise_id: exerciseId,
        plan_block_exercise_id: planBlockExerciseId ?? null,
        unit_index: unitIndex,
        reps,
        completed_seconds: completedSeconds ?? null,
        side: side ?? null,
      }),
    });
    load();
  };

  const finishExercise = async (exerciseId: number, planBlockExerciseId: number | undefined) => {
    await apiFetch(`/api/sessions/${sessionId}/finished-exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercise_id: exerciseId, plan_block_exercise_id: planBlockExerciseId ?? null }),
    });
    load();
  };

  const setTimerAnchor = (slot: TimerSlot, phaseKey: string, durationSeconds: number) => {
    apiFetch(`/api/sessions/${sessionId}/timer-anchor/${slot}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase_key: phaseKey, duration_seconds: durationSeconds }),
    }).catch(() => {});
  };

  const setStatus = async (status: string) => {
    await apiFetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    onFinished();
  };

  const blocks = session?.day_snapshot.blocks ?? [];
  const activeBlockIndex = session
    ? blocks.findIndex((block) => !isBlockDone(block, session.logged_sets, session.finished_exercises))
    : -1;

  useEffect(() => {
    if (session && activeBlockIndex === -1) setStatus('completed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, activeBlockIndex]);

  if (error) return <p className="text-sm text-danger">Fehler: {error}</p>;
  if (!session) return <p className="hint">Lade...</p>;

  const activeBlock = activeBlockIndex === -1 ? null : blocks[activeBlockIndex];
  const unitPosition = activeBlock
    ? activeUnitPosition(activeBlock, session.logged_sets, session.finished_exercises)
    : null;

  return (
    <div className="panel-accent flex flex-col items-start gap-4">
      <div>
        <strong className="text-fg">{session.day_snapshot.name}</strong>
        {activeBlock && (
          <span className="hint">
            {' '}
            — Block {activeBlockIndex + 1}/{blocks.length} ({activeBlock.training_method.name})
            {unitPosition && ` — Übung ${unitPosition.index + 1}/${unitPosition.total}`}
          </span>
        )}
      </div>
      {activeBlock ? (
        <BlockRunner
          session={session}
          block={activeBlock}
          phaseKeyBase={`b${activeBlockIndex}`}
          logSet={logSet}
          finishExercise={finishExercise}
          setTimerAnchor={setTimerAnchor}
        />
      ) : (
        <p>Training abgeschlossen.</p>
      )}
      <button type="button" className="btn-danger" onClick={() => abortDialogRef.current?.open()}>
        Training abbrechen
      </button>
      <ConfirmDialog
        ref={abortDialogRef}
        message="Training wirklich abbrechen?"
        confirmLabel="Abbrechen"
        onConfirm={() => setStatus('aborted')}
      />
    </div>
  );
}
