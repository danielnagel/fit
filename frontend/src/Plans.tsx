import { useEffect, useRef, useState } from 'react';
import PlanForm from './PlanForm';
import PlanDetail from './PlanDetail';
import type { PlanDetailData } from './PlanDetail';
import ConfirmDialog from './ConfirmDialog';
import type { ConfirmDialogHandle } from './ConfirmDialog';
import { apiFetch } from './api';

type Plan = {
  id: number;
  name: string;
  day_count: number;
};
type Exercise = { id: number; name: string; is_unilateral: boolean };

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const deleteDialogRef = useRef<ConfirmDialogHandle>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, PlanDetailData>>({});

  const loadPlans = () => {
    apiFetch('/api/plans')
      .then((res) => res.json())
      .then(setPlans)
      .catch((err) => setError(String(err)));
  };

  useEffect(() => {
    loadPlans();
    apiFetch('/api/exercises')
      .then((res) => res.json())
      .then(setExercises)
      .catch((err) => setError(String(err)));
  }, []);

  const openNew = () => {
    setEditingId(undefined);
    setMode('form');
  };
  const openEdit = (id: number) => {
    setEditingId(id);
    setMode('form');
  };
  const closeForm = () => {
    setMode('list');
    loadPlans();
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!details[id]) {
      apiFetch(`/api/plans/${id}`)
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
    const res = await apiFetch(`/api/plans/${pendingDeleteId}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Error (${res.status})`);
      return;
    }
    if (expandedId === pendingDeleteId) setExpandedId(null);
    loadPlans();
  };

  return (
    <section className="card">
      <h2 className="mb-4">Training plans</h2>
      {error && <p className="mb-3 text-sm text-danger">Error: {error}</p>}

      {mode === 'form' && (
        <PlanForm planId={editingId} exercises={exercises} onDone={closeForm} onCancel={closeForm} />
      )}

      {mode === 'list' && (
        <>
          <ul className="mb-4 flex flex-col gap-2">
            {plans.map((plan) => (
              <li key={plan.id} className="flex flex-col gap-3 rounded-xl border border-edge bg-surface-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-fg">{plan.name}</strong>
                  <span className="hint">– {plan.day_count} training day{plan.day_count === 1 ? '' : 's'}</span>
                  <div className="ml-auto flex gap-2">
                    <button type="button" className="btn" onClick={() => toggleExpand(plan.id)}>
                      {expandedId === plan.id ? 'Hide details' : 'Details'}
                    </button>
                    <button type="button" className="btn" onClick={() => openEdit(plan.id)}>
                      Edit
                    </button>
                    <button type="button" className="btn-danger" onClick={() => requestDelete(plan.id)}>
                      Delete
                    </button>
                  </div>
                </div>
                {expandedId === plan.id &&
                  (!details[plan.id] ? <p className="hint">Loading details...</p> : <PlanDetail plan={details[plan.id]} />)}
              </li>
            ))}
          </ul>
          <button type="button" className="btn-primary" onClick={openNew}>
            New plan
          </button>
        </>
      )}

      <ConfirmDialog ref={deleteDialogRef} message="Really delete this plan?" onConfirm={handleDelete} />
    </section>
  );
}
