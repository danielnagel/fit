import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { TrainingMethod } from './trainingMethods';
import { apiFetch } from './api';

type Exercise = { id: number; name: string; is_unilateral: boolean };

type ExerciseForm = {
  exercise_id: string;
  reps_min: string;
  reps_max: string;
  note: string;
  is_unilateral_active: boolean;
};
type BlockForm = { training_method_id: string; exercises: ExerciseForm[] };
type DayForm = { name: string; blocks: BlockForm[] };

type Props = {
  planId?: number;
  exercises: Exercise[];
  onDone: () => void;
  onCancel: () => void;
};

const emptyExerciseSlot = (repsMin = '', repsMax = ''): ExerciseForm => ({
  exercise_id: '',
  reps_min: repsMin,
  reps_max: repsMax,
  note: '',
  is_unilateral_active: false,
});

const emptyPair = (): ExerciseForm[] => [emptyExerciseSlot('1', '5'), emptyExerciseSlot('6', '12')];

function emptyBlock(method?: TrainingMethod): BlockForm {
  return {
    training_method_id: method ? String(method.id) : '',
    exercises: method?.scope === 'pair' ? emptyPair() : [emptyExerciseSlot()],
  };
}

function emptyDay(methods: TrainingMethod[], name = ''): DayForm {
  return { name, blocks: [emptyBlock(methods[0])] };
}

const numToStr = (n: number | null | undefined): string => (n == null ? '' : String(n));

export default function PlanForm({ planId, exercises, onDone, onCancel }: Props) {
  const [name, setName] = useState('');
  const [days, setDays] = useState<DayForm[]>([]);
  const [methods, setMethods] = useState<TrainingMethod[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const methodsById = useMemo(() => new Map(methods.map((m) => [String(m.id), m])), [methods]);
  const exercisesById = useMemo(() => new Map(exercises.map((e) => [String(e.id), e])), [exercises]);

  useEffect(() => {
    apiFetch('/api/training-methods')
      .then((res) => res.json())
      .then((loadedMethods: TrainingMethod[]) => {
        setMethods(loadedMethods);
        if (planId === undefined) {
          setDays([emptyDay(loadedMethods)]);
          setLoading(false);
          return;
        }
        apiFetch(`/api/plans/${planId}`)
          .then((res) => res.json())
          .then((plan) => {
            setName(plan.name);
            setDays(
              plan.days.length
                ? plan.days.map((day: any) => ({
                    name: day.name,
                    blocks: day.blocks.length
                      ? day.blocks.map((block: any) => ({
                          training_method_id: String(block.training_method.id),
                          exercises: block.exercises.length
                            ? block.exercises.map((ex: any) => ({
                                exercise_id: String(ex.exercise_id),
                                reps_min: numToStr(ex.reps_min),
                                reps_max: numToStr(ex.reps_max),
                                note: ex.note ?? '',
                                is_unilateral_active: Boolean(ex.is_unilateral_active),
                              }))
                            : emptyBlock(loadedMethods[0]).exercises,
                        }))
                      : [emptyBlock(loadedMethods[0])],
                  }))
                : [emptyDay(loadedMethods)],
            );
          })
          .catch((err) => setError(String(err)))
          .finally(() => setLoading(false));
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const addDay = () => setDays((prev) => [...prev, emptyDay(methods)]);
  const removeDay = (dayIdx: number) => setDays((prev) => prev.filter((_, i) => i !== dayIdx));
  const updateDayName = (dayIdx: number, value: string) =>
    setDays((prev) => prev.map((day, i) => (i === dayIdx ? { ...day, name: value } : day)));

  const addBlock = (dayIdx: number) =>
    setDays((prev) =>
      prev.map((day, i) => (i === dayIdx ? { ...day, blocks: [...day.blocks, emptyBlock(methods[0])] } : day)),
    );
  const removeBlock = (dayIdx: number, blockIdx: number) =>
    setDays((prev) =>
      prev.map((day, i) => (i === dayIdx ? { ...day, blocks: day.blocks.filter((_, j) => j !== blockIdx) } : day)),
    );
  const updateBlockMethod = (dayIdx: number, blockIdx: number, methodId: string) =>
    setDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIdx) return day;
        return {
          ...day,
          blocks: day.blocks.map((block, j) => {
            if (j !== blockIdx) return block;
            const oldScope = methodsById.get(block.training_method_id)?.scope;
            const newScope = methodsById.get(methodId)?.scope;
            const exercises = oldScope === newScope ? block.exercises : emptyBlock(methodsById.get(methodId)).exercises;
            return { training_method_id: methodId, exercises };
          }),
        };
      }),
    );

  const addExercise = (dayIdx: number, blockIdx: number) =>
    setDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIdx) return day;
        return {
          ...day,
          blocks: day.blocks.map((block, j) => {
            if (j !== blockIdx) return block;
            const scope = methodsById.get(block.training_method_id)?.scope;
            const additions = scope === 'pair' ? emptyPair() : [emptyExerciseSlot()];
            return { ...block, exercises: [...block.exercises, ...additions] };
          }),
        };
      }),
    );
  const removeExercise = (dayIdx: number, blockIdx: number, exIdx: number) =>
    setDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIdx) return day;
        return {
          ...day,
          blocks: day.blocks.map((block, j) => {
            if (j !== blockIdx) return block;
            const scope = methodsById.get(block.training_method_id)?.scope;
            if (scope === 'pair') {
              const pairStart = exIdx % 2 === 0 ? exIdx : exIdx - 1;
              return { ...block, exercises: block.exercises.filter((_, k) => k !== pairStart && k !== pairStart + 1) };
            }
            return { ...block, exercises: block.exercises.filter((_, k) => k !== exIdx) };
          }),
        };
      }),
    );
  const updateExerciseField = <K extends keyof ExerciseForm>(
    dayIdx: number,
    blockIdx: number,
    exIdx: number,
    field: K,
    value: ExerciseForm[K],
  ) =>
    setDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIdx) return day;
        return {
          ...day,
          blocks: day.blocks.map((block, j) =>
            j !== blockIdx
              ? block
              : {
                  ...block,
                  exercises: block.exercises.map((ex, k) => {
                    if (k !== exIdx) return ex;
                    const updated = { ...ex, [field]: value };
                    if (field === 'exercise_id' && !exercisesById.get(updated.exercise_id)?.is_unilateral) {
                      updated.is_unilateral_active = false;
                    }
                    return updated;
                  }),
                },
          ),
        };
      }),
    );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const toNum = (v: string, fallback: number | null = null) => (v === '' ? fallback : Number(v));

    const body = {
      name,
      days: days.map((day) => ({
        name: day.name,
        blocks: day.blocks.map((block) => {
          const method = methodsById.get(block.training_method_id);
          const showReps = method?.timing_family === 'fixed-window-remainder';
          return {
            training_method_id: Number(block.training_method_id),
            exercises: block.exercises.map((ex, exIdx) => {
              const isHeavyPairSlot = method?.scope === 'pair' && exIdx % 2 === 0;
              return {
                exercise_id: Number(ex.exercise_id),
                reps_min: toNum(ex.reps_min, showReps ? (isHeavyPairSlot ? 1 : 6) : null),
                reps_max: toNum(ex.reps_max, showReps ? (isHeavyPairSlot ? 5 : 12) : null),
                note: ex.note.trim() || null,
                is_unilateral_active: ex.is_unilateral_active,
              };
            }),
          };
        }),
      })),
    };

    const res = await apiFetch(planId === undefined ? '/api/plans' : `/api/plans/${planId}`, {
      method: planId === undefined ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      setError(errBody.message ?? `Fehler (${res.status})`);
      return;
    }

    onDone();
  };

  if (loading) return <p className="hint">Lade...</p>;

  return (
    <form className="panel-accent flex flex-col items-start gap-3" onSubmit={handleSubmit}>
      {error && <p className="text-sm text-danger">Fehler: {error}</p>}
      <label className="flex items-center gap-2">
        Name <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      {days.map((day, dayIdx) => (
        <fieldset key={dayIdx} className="w-full rounded-xl border border-edge bg-surface-3 p-4">
          <legend className="mb-3 flex flex-wrap items-center gap-2 px-1">
            <input
              className="field"
              value={day.name}
              onChange={(e) => updateDayName(dayIdx, e.target.value)}
              placeholder="Trainingstag-Name"
              required
            />
            <button type="button" className="btn-danger" onClick={() => removeDay(dayIdx)}>
              Tag entfernen
            </button>
          </legend>

          {day.blocks.map((block, blockIdx) => {
            const method = methodsById.get(block.training_method_id);
            const scope = method?.scope;
            const showReps = method?.timing_family === 'fixed-window-remainder';
            const allowUnilateral =
              method?.timing_family === 'fixed-window-remainder' ||
              method?.timing_family === 'fixed-work-rest' ||
              (method?.timing_family === 'self-paced' && method.scope === 'single');
            return (
              <fieldset key={blockIdx} className="mb-3 rounded-lg border border-edge bg-surface-2 p-3">
                <legend className="mb-2 flex flex-wrap items-center gap-2 px-1">
                  <select
                    className="field"
                    value={block.training_method_id}
                    onChange={(e) => updateBlockMethod(dayIdx, blockIdx, e.target.value)}
                    required
                  >
                    <option value="">Methode wählen...</option>
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  {day.blocks.length > 1 && (
                    <button type="button" className="btn-danger" onClick={() => removeBlock(dayIdx, blockIdx)}>
                      Block entfernen
                    </button>
                  )}
                </legend>

                {block.exercises.map((ex, exIdx) => (
                  <div key={exIdx} className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-surface-3 px-3 py-2">
                    <select
                      className="field"
                      value={ex.exercise_id}
                      onChange={(e) => updateExerciseField(dayIdx, blockIdx, exIdx, 'exercise_id', e.target.value)}
                      required
                    >
                      <option value="">Übung wählen...</option>
                      {exercises.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                    {scope === 'pair' && <span className="hint">{exIdx % 2 === 0 ? 'schwer' : 'leicht'}</span>}
                    {showReps && (() => {
                      const isHeavyPairSlot = scope === 'pair' && exIdx % 2 === 0;
                      const repsMinPlaceholder = isHeavyPairSlot ? '1' : '6';
                      const repsMaxPlaceholder = isHeavyPairSlot ? '5' : '12';
                      return (
                        <>
                          <label className="flex items-center gap-1.5">
                            Wdh. von{' '}
                            <input
                              type="number"
                              min={0}
                              placeholder={repsMinPlaceholder}
                              value={ex.reps_min}
                              onChange={(e) => updateExerciseField(dayIdx, blockIdx, exIdx, 'reps_min', e.target.value)}
                              className="field w-16"
                            />
                          </label>
                          <label className="flex items-center gap-1.5">
                            bis{' '}
                            <input
                              type="number"
                              min={0}
                              placeholder={repsMaxPlaceholder}
                              value={ex.reps_max}
                              onChange={(e) => updateExerciseField(dayIdx, blockIdx, exIdx, 'reps_max', e.target.value)}
                              className="field w-16"
                            />
                          </label>
                        </>
                      );
                    })()}
                    <input
                      value={ex.note}
                      onChange={(e) => updateExerciseField(dayIdx, blockIdx, exIdx, 'note', e.target.value)}
                      placeholder="Variante (optional, z. B. 3 Sek. Haltezeit am tiefsten Punkt)"
                      className="field w-full max-w-md"
                    />
                    {allowUnilateral && exercisesById.get(ex.exercise_id)?.is_unilateral && (
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={ex.is_unilateral_active}
                          onChange={(e) =>
                            updateExerciseField(dayIdx, blockIdx, exIdx, 'is_unilateral_active', e.target.checked)
                          }
                        />
                        einseitig
                      </label>
                    )}
                    {(scope !== 'pair' ? block.exercises.length > 1 : block.exercises.length > 2) && (
                      <button type="button" className="btn-danger" onClick={() => removeExercise(dayIdx, blockIdx, exIdx)}>
                        Übung entfernen
                      </button>
                    )}
                  </div>
                ))}

                <button type="button" className="btn" onClick={() => addExercise(dayIdx, blockIdx)}>
                  {scope === 'pair' ? 'Paar hinzufügen' : 'Übung hinzufügen'}
                </button>
              </fieldset>
            );
          })}

          <button type="button" className="btn" onClick={() => addBlock(dayIdx)}>
            Block hinzufügen
          </button>
        </fieldset>
      ))}
      <button type="button" className="btn" onClick={addDay}>
        Trainingstag hinzufügen
      </button>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary">
          Speichern
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
