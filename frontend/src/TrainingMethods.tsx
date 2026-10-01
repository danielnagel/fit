import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import ConfirmDialog from './ConfirmDialog';
import type { ConfirmDialogHandle } from './ConfirmDialog';
import DurationInput from './DurationInput';
import type { TrainingMethod, Scope, TimingFamily, RestFormula, StopCondition } from './trainingMethods';
import { SCOPE_LABELS, TIMING_FAMILY_LABELS, REST_FORMULA_LABELS, STOP_CONDITION_LABELS } from './trainingMethods';
import { apiFetch } from './api';

type MethodForm = {
  name: string;
  scope: Scope;
  timing_family: TimingFamily;
  window_seconds: string;
  work_seconds: string;
  rest_seconds: string;
  rest_formula: RestFormula;
  rest_factor: string;
  stop_condition: StopCondition;
  rounds: string;
  total_duration_seconds: string;
};

const numToStr = (n: number | null | undefined): string => (n == null ? '' : String(n));

const emptyForm = (): MethodForm => ({
  name: '',
  scope: 'single',
  timing_family: 'fixed-window-remainder',
  window_seconds: '180',
  work_seconds: '20',
  rest_seconds: '10',
  rest_formula: 'proportional',
  rest_factor: '1',
  stop_condition: 'fixed-count',
  rounds: '3',
  total_duration_seconds: '600',
});

const formFromMethod = (m: TrainingMethod): MethodForm => ({
  name: m.name,
  scope: m.scope,
  timing_family: m.timing_family,
  window_seconds: numToStr(m.window_seconds) || '180',
  work_seconds: numToStr(m.work_seconds) || '20',
  rest_seconds: numToStr(m.rest_seconds) || '10',
  rest_formula: m.rest_formula ?? 'proportional',
  rest_factor: numToStr(m.rest_factor) || '1',
  stop_condition: m.stop_condition,
  rounds: numToStr(m.rounds) || '3',
  total_duration_seconds: numToStr(m.total_duration_seconds) || '600',
});

function toBody(form: MethodForm) {
  return {
    name: form.name.trim(),
    scope: form.scope,
    timing_family: form.timing_family,
    window_seconds: form.window_seconds === '' ? null : Number(form.window_seconds),
    work_seconds: form.work_seconds === '' ? null : Number(form.work_seconds),
    rest_seconds: form.rest_seconds === '' ? null : Number(form.rest_seconds),
    rest_formula: form.timing_family === 'self-paced' ? form.rest_formula : null,
    rest_factor: form.rest_factor === '' ? null : Number(form.rest_factor),
    stop_condition: form.stop_condition,
    rounds: form.rounds === '' ? null : Number(form.rounds),
    total_duration_seconds: form.total_duration_seconds === '' ? null : Number(form.total_duration_seconds),
  };
}

type FieldsProps = {
  form: MethodForm;
  update: <K extends keyof MethodForm>(field: K, value: MethodForm[K]) => void;
};

function MethodFields({ form, update }: FieldsProps) {
  return (
    <>
      <label className="flex items-center gap-2">
        Name <input className="field" value={form.name} onChange={(e) => update('name', e.target.value)} required />
      </label>
      <label className="flex items-center gap-2">
        Umfang{' '}
        <select className="field" value={form.scope} onChange={(e) => update('scope', e.target.value as Scope)}>
          {(Object.keys(SCOPE_LABELS) as Scope[]).map((s) => (
            <option key={s} value={s}>
              {SCOPE_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        Timing{' '}
        <select
          className="field"
          value={form.timing_family}
          onChange={(e) => update('timing_family', e.target.value as TimingFamily)}
        >
          {(Object.keys(TIMING_FAMILY_LABELS) as TimingFamily[]).map((t) => (
            <option key={t} value={t}>
              {TIMING_FAMILY_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      {form.timing_family === 'fixed-window-remainder' && (
        <label className="flex items-center gap-2">
          Fensterdauer je Runde{' '}
          <DurationInput seconds={form.window_seconds} onChange={(v) => update('window_seconds', v)} />
        </label>
      )}

      {form.timing_family === 'fixed-work-rest' && (
        <>
          <label className="flex items-center gap-2">
            Belastung je Runde <DurationInput seconds={form.work_seconds} onChange={(v) => update('work_seconds', v)} />
          </label>
          <label className="flex items-center gap-2">
            Pause je Runde <DurationInput seconds={form.rest_seconds} onChange={(v) => update('rest_seconds', v)} />
          </label>
        </>
      )}

      {form.timing_family === 'self-paced' && (
        <>
          <label className="flex items-center gap-2">
            Pausenformel{' '}
            <select
              className="field"
              value={form.rest_formula}
              onChange={(e) => update('rest_formula', e.target.value as RestFormula)}
            >
              {(Object.keys(REST_FORMULA_LABELS) as RestFormula[]).map((f) => (
                <option key={f} value={f}>
                  {REST_FORMULA_LABELS[f]}
                </option>
              ))}
            </select>
          </label>
          {form.rest_formula === 'proportional' ? (
            <label className="flex items-center gap-2">
              Faktor (× Satzdauer){' '}
              <input
                type="number"
                min={0}
                step={0.1}
                value={form.rest_factor}
                onChange={(e) => update('rest_factor', e.target.value)}
                className="field w-20"
              />
            </label>
          ) : (
            <label className="flex items-center gap-2">
              Pause nach jedem Satz <DurationInput seconds={form.rest_seconds} onChange={(v) => update('rest_seconds', v)} />
            </label>
          )}
        </>
      )}

      <label className="flex items-center gap-2">
        Stopp-Bedingung{' '}
        <select
          className="field"
          value={form.stop_condition}
          onChange={(e) => update('stop_condition', e.target.value as StopCondition)}
        >
          {(Object.keys(STOP_CONDITION_LABELS) as StopCondition[]).map((c) => (
            <option key={c} value={c}>
              {STOP_CONDITION_LABELS[c]}
            </option>
          ))}
        </select>
      </label>

      {form.stop_condition === 'fixed-count' && (
        <label className="flex items-center gap-2">
          Rundenzahl{' '}
          <input
            type="number"
            min={1}
            value={form.rounds}
            onChange={(e) => update('rounds', e.target.value)}
            className="field w-20"
          />
        </label>
      )}
      {form.stop_condition === 'time-budget' && (
        <label className="flex items-center gap-2">
          Zeitbudget{' '}
          <DurationInput seconds={form.total_duration_seconds} onChange={(v) => update('total_duration_seconds', v)} />
        </label>
      )}
    </>
  );
}

export function describeMethod(m: TrainingMethod): string {
  const parts = [SCOPE_LABELS[m.scope], TIMING_FAMILY_LABELS[m.timing_family]];
  if (m.stop_condition === 'fixed-count') parts.push(`${m.rounds} Runden`);
  if (m.stop_condition === 'time-budget') parts.push(`Budget ${Math.round((m.total_duration_seconds ?? 0) / 60)} Min`);
  if (m.stop_condition === 'all-exercises-done') parts.push('manuell beenden');
  return parts.join(' · ');
}

export default function TrainingMethods() {
  const [methods, setMethods] = useState<TrainingMethod[]>([]);
  const [form, setForm] = useState<MethodForm>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<MethodForm>(emptyForm());
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const deleteDialogRef = useRef<ConfirmDialogHandle>(null);

  const load = () => {
    apiFetch('/api/training-methods')
      .then((res) => res.json())
      .then(setMethods)
      .catch((err) => setError(String(err)));
  };

  useEffect(load, []);

  const updateForm = <K extends keyof MethodForm>(field: K, value: MethodForm[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const updateEditForm = <K extends keyof MethodForm>(field: K, value: MethodForm[K]) =>
    setEditForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await apiFetch('/api/training-methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toBody(form)),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Fehler (${res.status})`);
      return;
    }
    setForm(emptyForm());
    load();
  };

  const startEdit = (m: TrainingMethod) => {
    setEditingId(m.id);
    setEditForm(formFromMethod(m));
  };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: number) => {
    setError(null);
    const res = await apiFetch(`/api/training-methods/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toBody(editForm)),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Fehler (${res.status})`);
      return;
    }
    setEditingId(null);
    load();
  };

  const requestDelete = (id: number) => {
    setPendingDeleteId(id);
    deleteDialogRef.current?.open();
  };

  const handleDelete = async () => {
    if (pendingDeleteId === null) return;
    const res = await apiFetch(`/api/training-methods/${pendingDeleteId}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Fehler (${res.status})`);
      return;
    }
    load();
  };

  return (
    <section className="card">
      <h2 className="mb-2">Trainingsmethoden</h2>
      <p className="hint mb-4">
        Der Katalog der Trainingsmethoden, aus dem beim Planen von Trainingstagen ausgewählt wird. Jede Methode legt
        fest, wie viele Übungen zusammengehören, wie Belastung/Pause getaktet werden und wann eine Einheit beendet
        ist.
      </p>
      {error && <p className="mb-3 text-sm text-danger">Fehler: {error}</p>}
      <ul className="mb-5 flex flex-col gap-2">
        {methods.map((m) =>
          editingId === m.id ? (
            <li key={m.id} className="panel-accent flex flex-col items-start gap-3">
              <MethodFields form={editForm} update={updateEditForm} />
              <div className="flex gap-2">
                <button type="button" className="btn-primary" onClick={() => saveEdit(m.id)}>
                  Speichern
                </button>
                <button type="button" className="btn" onClick={cancelEdit}>
                  Abbrechen
                </button>
              </div>
            </li>
          ) : (
            <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-edge bg-surface-2 px-4 py-3">
              <strong className="text-fg">{m.name}</strong> <span className="hint">— {describeMethod(m)}</span>
              <div className="ml-auto flex gap-2">
                <button type="button" className="btn" onClick={() => startEdit(m)}>
                  Bearbeiten
                </button>
                <button type="button" className="btn-danger" onClick={() => requestDelete(m.id)}>
                  Löschen
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
      <form className="panel-accent flex flex-col items-start gap-3" onSubmit={handleSubmit}>
        <h3>Neue Methode</h3>
        <MethodFields form={form} update={updateForm} />
        <button type="submit" className="btn-primary">
          Hinzufügen
        </button>
      </form>
      <ConfirmDialog
        ref={deleteDialogRef}
        message="Methode wirklich löschen? Das schlägt fehl, solange sie noch in einem Plan verwendet wird."
        onConfirm={handleDelete}
      />
    </section>
  );
}
