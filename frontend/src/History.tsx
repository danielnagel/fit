import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressChart from './ProgressChart';
import type { ProgressPoint } from './ProgressChart';
import ConfirmDialog from './ConfirmDialog';
import type { ConfirmDialogHandle } from './ConfirmDialog';
import { formatMmSs } from './useTimer';
import { apiFetch } from './api';

type SessionListItem = {
  id: number;
  plan_day_id: number | null;
  plan_week_id: number;
  plan_id: number;
  plan_name: string;
  week_started_at: string;
  day_snapshot: { name: string; blocks?: { training_method: { name: string } }[] };
  status: 'in_progress' | 'completed' | 'aborted';
  started_at: string;
  completed_at: string | null;
};
type SessionWeekGroup = {
  plan_week_id: number;
  plan_name: string;
  week_started_at: string;
  sessions: SessionListItem[];
};
type Exercise = { id: number; name: string };
type LoggedSetDetail = {
  id: number;
  exercise_id: number;
  unit_index: number;
  reps: number | null;
  completed_seconds: number | null;
  side: 'left' | 'right' | null;
  performed_at: string;
};
type SessionDetail = SessionListItem & { logged_sets: LoggedSetDetail[] };

const STATUS_LABELS: Record<SessionListItem['status'], string> = {
  in_progress: 'In progress',
  completed: 'Completed',
  aborted: 'Aborted',
};

function groupSessionsByWeek(sessions: SessionListItem[]): SessionWeekGroup[] {
  const groups: SessionWeekGroup[] = [];
  const byWeekId = new Map<number, SessionWeekGroup>();
  for (const s of sessions) {
    let group = byWeekId.get(s.plan_week_id);
    if (!group) {
      group = {
        plan_week_id: s.plan_week_id,
        plan_name: s.plan_name,
        week_started_at: s.week_started_at,
        sessions: [],
      };
      byWeekId.set(s.plan_week_id, group);
      groups.push(group);
    }
    group.sessions.push(s);
  }
  return groups;
}

export default function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseId, setExerciseId] = useState('');
  const [progress, setProgress] = useState<ProgressPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedWeekId, setExpandedWeekId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, SessionDetail>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const deleteDialogRef = useRef<ConfirmDialogHandle>(null);
  const [pendingDeleteSet, setPendingDeleteSet] = useState<{ sessionId: number; setId: number } | null>(null);
  const deleteSetDialogRef = useRef<ConfirmDialogHandle>(null);

  const loadSessions = () => {
    apiFetch('/api/sessions')
      .then((res) => res.json())
      .then(setSessions)
      .catch((err) => setError(String(err)));
  };

  useEffect(() => {
    loadSessions();
    apiFetch('/api/exercises')
      .then((res) => res.json())
      .then(setExercises)
      .catch((err) => setError(String(err)));
  }, []);

  useEffect(() => {
    if (!exerciseId) {
      setProgress(null);
      return;
    }
    apiFetch(`/api/exercises/${exerciseId}/progress`)
      .then((res) => res.json())
      .then(setProgress)
      .catch((err) => setError(String(err)));
  }, [exerciseId]);

  const exerciseName = (id: number) => exercises.find((ex) => ex.id === id)?.name ?? `Exercise #${id}`;

  const toggleExpandWeek = (id: number) => {
    setExpandedWeekId((prev) => (prev === id ? null : id));
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!details[id]) {
      apiFetch(`/api/sessions/${id}`)
        .then((res) => res.json())
        .then((detail) => setDetails((prev) => ({ ...prev, [id]: detail })))
        .catch((err) => setError(String(err)));
    }
  };

  const requestDelete = (id: number) => {
    setPendingDeleteId(id);
    deleteDialogRef.current?.open();
  };

  const handleDelete = async () => {
    if (pendingDeleteId === null) return;
    const res = await apiFetch(`/api/sessions/${pendingDeleteId}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Error (${res.status})`);
      return;
    }
    if (expandedId === pendingDeleteId) setExpandedId(null);
    loadSessions();
  };

  const requestDeleteSet = (sessionId: number, setId: number) => {
    setPendingDeleteSet({ sessionId, setId });
    deleteSetDialogRef.current?.open();
  };

  const handleDeleteSet = async () => {
    if (!pendingDeleteSet) return;
    const { sessionId, setId } = pendingDeleteSet;
    const res = await apiFetch(`/api/sessions/${sessionId}/logged-sets/${setId}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Error (${res.status})`);
      return;
    }
    const detail = await apiFetch(`/api/sessions/${sessionId}`).then((r) => r.json());
    setDetails((prev) => ({ ...prev, [sessionId]: detail }));
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="card">
        <h2 className="mb-4">Progress</h2>
        {error && <p className="mb-3 text-sm text-danger">Error: {error}</p>}
        <label className="flex items-center gap-2">
          Exercise{' '}
          <select className="field" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
            <option value="">Choose exercise...</option>
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </label>
        {progress && <ProgressChart points={progress} />}
      </section>

      <section className="card">
        <h2 className="mb-4">Training history</h2>
        {sessions.length === 0 ? (
          <p className="hint">No trainings done yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {groupSessionsByWeek(sessions).map((group) => (
              <li key={group.plan_week_id} className="rounded-xl border border-edge bg-surface-3 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3>
                    {group.plan_name}{' '}
                    <span className="hint font-normal">({new Date(group.week_started_at).toLocaleDateString('en-GB')})</span>
                  </h3>
                  <button type="button" className="btn ml-auto" onClick={() => toggleExpandWeek(group.plan_week_id)}>
                    {expandedWeekId === group.plan_week_id ? 'Hide week' : 'Show week'}
                  </button>
                </div>
                {expandedWeekId === group.plan_week_id && (
                  <ul className="mt-3 flex flex-col gap-2">
                    {group.sessions.map((s) => (
                      <li key={s.id} className="rounded-xl border border-edge bg-surface-2 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="hint">{new Date(s.started_at).toLocaleDateString('en-GB')}</span>
                          <strong className="text-fg">{s.day_snapshot.name}</strong>
                          {s.day_snapshot.blocks && s.day_snapshot.blocks.length > 0 && (
                            <span className="hint">({s.day_snapshot.blocks.map((b) => b.training_method.name).join(', ')})</span>
                          )}
                          <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-fg-muted">
                            {STATUS_LABELS[s.status]}
                          </span>
                          <div className="ml-auto flex gap-2">
                            <button type="button" className="btn" onClick={() => toggleExpand(s.id)}>
                              {expandedId === s.id ? 'Hide details' : 'Details'}
                            </button>
                            {s.status === 'in_progress' && (
                              <button type="button" className="btn" onClick={() => navigate(`/training?session=${s.id}`)}>
                                Resume
                              </button>
                            )}
                            <button type="button" className="btn-danger" onClick={() => requestDelete(s.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                        {expandedId === s.id &&
                          (!details[s.id] ? (
                            <p className="hint mt-2">Loading details...</p>
                          ) : details[s.id].logged_sets.length === 0 ? (
                            <p className="hint mt-2">No logged sets.</p>
                          ) : (
                            <div className="mt-3 overflow-x-auto rounded-lg border border-edge">
                              <table className="w-full border-collapse text-sm">
                                <thead>
                                  <tr className="bg-surface-3 text-left text-fg-muted">
                                    <th className="px-3 py-2 font-medium">Exercise</th>
                                    <th className="px-3 py-2 font-medium">Unit</th>
                                    <th className="px-3 py-2 font-medium">Reps</th>
                                    <th className="px-3 py-2 font-medium">Side</th>
                                    <th className="px-3 py-2 font-medium">Set time</th>
                                    <th className="px-3 py-2 font-medium">Time</th>
                                    <th className="px-3 py-2"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {details[s.id].logged_sets.map((set) => (
                                    <tr key={set.id} className="border-t border-edge">
                                      <td className="px-3 py-2">{exerciseName(set.exercise_id)}</td>
                                      <td className="px-3 py-2">{set.unit_index + 1}</td>
                                      <td className="px-3 py-2">{set.reps ?? '–'}</td>
                                      <td className="px-3 py-2">{set.side === 'left' ? 'left' : set.side === 'right' ? 'right' : '–'}</td>
                                      <td className="px-3 py-2">{set.completed_seconds != null ? formatMmSs(set.completed_seconds) : '–'}</td>
                                      <td className="px-3 py-2">{new Date(set.performed_at).toLocaleTimeString('en-GB')}</td>
                                      <td className="px-3 py-2">
                                        <button type="button" className="btn-danger" onClick={() => requestDeleteSet(s.id, set.id)}>
                                          Delete
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        ref={deleteDialogRef}
        message="Permanently delete this training? This cannot be undone."
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        ref={deleteSetDialogRef}
        message="Delete this set from the history? This cannot be undone."
        onConfirm={handleDeleteSet}
      />
    </div>
  );
}
