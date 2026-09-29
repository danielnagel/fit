import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import ConfirmDialog from './ConfirmDialog';
import type { ConfirmDialogHandle } from './ConfirmDialog';

type Exercise = { id: number; name: string; description: string | null; is_unilateral: boolean; created_at: string };

export default function Exercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isUnilateral, setIsUnilateral] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsUnilateral, setEditIsUnilateral] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const deleteDialogRef = useRef<ConfirmDialogHandle>(null);

  const load = () => {
    fetch('/api/exercises')
      .then((res) => res.json())
      .then(setExercises)
      .catch((err) => setError(String(err)));
  };

  useEffect(load, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = await fetch('/api/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, is_unilateral: isUnilateral }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Fehler (${res.status})`);
      return;
    }

    setName('');
    setDescription('');
    setIsUnilateral(false);
    load();
  };

  const startEdit = (ex: Exercise) => {
    setEditingId(ex.id);
    setEditName(ex.name);
    setEditDescription(ex.description ?? '');
    setEditIsUnilateral(ex.is_unilateral);
  };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: number) => {
    setError(null);
    const res = await fetch(`/api/exercises/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, description: editDescription, is_unilateral: editIsUnilateral }),
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
    setError(null);
    const res = await fetch(`/api/exercises/${pendingDeleteId}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Fehler (${res.status})`);
      return;
    }
    load();
  };

  return (
    <section className="card">
      <h2 className="mb-4">Übungen</h2>
      {error && <p className="mb-3 text-sm text-danger">Fehler: {error}</p>}
      <ul className="mb-5 flex flex-col gap-2">
        {exercises.map((ex) =>
          editingId === ex.id ? (
            <li key={ex.id} className="panel-accent flex flex-col items-start gap-3">
              <input
                className="field w-full"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Name"
                required
              />
              <textarea
                className="field w-full max-w-md"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Beschreibung (optional)"
              />
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editIsUnilateral}
                  onChange={(e) => setEditIsUnilateral(e.target.checked)}
                />
                kann einseitig ausgeführt werden
              </label>
              <div className="flex gap-2">
                <button type="button" className="btn-primary" onClick={() => saveEdit(ex.id)}>
                  Speichern
                </button>
                <button type="button" className="btn" onClick={cancelEdit}>
                  Abbrechen
                </button>
              </div>
            </li>
          ) : (
            <li key={ex.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-edge bg-surface-2 px-4 py-3">
              <strong className="text-fg">{ex.name}</strong>
              {ex.description && (
                <span className="hint truncate max-w-56" title={ex.description}>
                  – {ex.description}
                </span>
              )}
              {ex.is_unilateral && <span className="hint">· einseitig</span>}
              <div className="ml-auto flex gap-2">
                <button type="button" className="btn" onClick={() => startEdit(ex)}>
                  Bearbeiten
                </button>
                <button type="button" className="btn-danger" onClick={() => requestDelete(ex.id)}>
                  Löschen
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
      <form onSubmit={handleSubmit} className="flex flex-col items-start gap-2.5">
        <input className="field w-full max-w-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
        <textarea
          className="field w-full max-w-md"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Beschreibung (optional)"
        />
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={isUnilateral} onChange={(e) => setIsUnilateral(e.target.checked)} />
          kann einseitig ausgeführt werden
        </label>
        <button type="submit" className="btn-primary">
          Hinzufügen
        </button>
      </form>
      <ConfirmDialog ref={deleteDialogRef} message="Übung wirklich löschen?" onConfirm={handleDelete} />
    </section>
  );
}
