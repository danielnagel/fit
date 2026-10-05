import { useEffect, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import type { ConfirmDialogHandle } from './ConfirmDialog';
import { apiFetch } from './api';

type Plan = { id: number; name: string; day_count: number };
type PlanDay = { id: number; name: string; blocks: { training_method: { name: string } }[] };
type ActiveWeekSession = { id: number; plan_day_id: number | null; status: string };
type ActiveWeek = {
  id: number;
  plan_id: number;
  plan_name: string;
  week_number: number;
  started_at: string;
  sessions: ActiveWeekSession[];
};

type Props = {
  onStarted: (sessionId: number) => void;
};

export default function SessionStart({ onStarted }: Props) {
  const [activeWeek, setActiveWeek] = useState<ActiveWeek | null | undefined>(undefined);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState('');
  const [days, setDays] = useState<PlanDay[]>([]);
  const [dayId, setDayId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const endDialogRef = useRef<ConfirmDialogHandle>(null);

  const loadActiveWeek = () => {
    apiFetch('/api/plan-weeks/active')
      .then((res) => res.json())
      .then(setActiveWeek)
      .catch((err) => setError(String(err)));
  };

  useEffect(loadActiveWeek, []);

  useEffect(() => {
    if (activeWeek === undefined) return;
    if (activeWeek) {
      apiFetch(`/api/plans/${activeWeek.plan_id}`)
        .then((res) => res.json())
        .then((plan) => setDays(plan.days))
        .catch((err) => setError(String(err)));
    } else {
      apiFetch('/api/plans')
        .then((res) => res.json())
        .then(setPlans)
        .catch((err) => setError(String(err)));
    }
  }, [activeWeek]);

  const handleStartWeek = async () => {
    setError(null);
    const res = await apiFetch('/api/plan-weeks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: Number(planId) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Error (${res.status})`);
      return;
    }
    loadActiveWeek();
  };

  const handleEndWeek = async () => {
    if (!activeWeek) return;
    setError(null);
    const res = await apiFetch(`/api/plan-weeks/${activeWeek.id}`, { method: 'PATCH' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Error (${res.status})`);
      return;
    }
    setDayId('');
    loadActiveWeek();
  };

  const handleStartTraining = async () => {
    setError(null);
    const res = await apiFetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_day_id: Number(dayId) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Error (${res.status})`);
      return;
    }
    const session = await res.json();
    onStarted(session.id);
  };

  if (activeWeek === undefined) return <p className="hint">Loading...</p>;

  const resumable = activeWeek?.sessions.find((s) => s.status === 'in_progress' && String(s.plan_day_id) === dayId);

  return (
    <div className="flex flex-col items-start gap-3">
      {error && <p className="text-sm text-danger">Error: {error}</p>}

      {!activeWeek ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            Plan{' '}
            <select className="field" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">Choose plan...</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-primary" disabled={!planId} onClick={handleStartWeek}>
            Start week
          </button>
        </div>
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-2">
            Current week: <strong className="text-fg">{activeWeek.plan_name}</strong> — week {activeWeek.week_number}
            <button type="button" className="btn-danger" onClick={() => endDialogRef.current?.open()}>
              End week
            </button>
          </p>

          {days.length > 0 && (
            <label className="flex items-center gap-2">
              Training day{' '}
              <select className="field" value={dayId} onChange={(e) => setDayId(e.target.value)}>
                <option value="">Choose training day...</option>
                {days.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.blocks.map((b) => b.training_method.name).join(', ')})
                  </option>
                ))}
              </select>
            </label>
          )}

          {dayId &&
            (resumable ? (
              <button type="button" className="btn-primary" onClick={() => onStarted(resumable.id)}>
                Resume (in progress)
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={handleStartTraining}>
                Start training
              </button>
            ))}
        </>
      )}

      <ConfirmDialog ref={endDialogRef} message="Really end the week?" confirmLabel="End" onConfirm={handleEndWeek} />
    </div>
  );
}
