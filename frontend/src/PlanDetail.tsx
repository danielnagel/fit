import type { TrainingMethod } from './trainingMethods';
import { describeMethod } from './TrainingMethods';

type PlanExercise = {
  id: number;
  exercise_name: string;
  reps_min: number | null;
  reps_max: number | null;
  note: string | null;
  is_unilateral_active: boolean;
};
type PlanBlock = { id: number; training_method: TrainingMethod; exercises: PlanExercise[] };
type PlanDay = { id: number; name: string; blocks: PlanBlock[] };
export type PlanDetailData = { id: number; name: string; days: PlanDay[] };

type Props = {
  plan: PlanDetailData;
};

export default function PlanDetail({ plan }: Props) {
  if (plan.days.length === 0) return <p className="hint mt-2">This plan doesn't have any training days yet.</p>;

  return (
    <div className="flex flex-col gap-2">
      {plan.days.map((day) => (
        <div key={day.id} className="rounded-lg border border-edge bg-surface-3 px-3 py-2.5">
          <strong className="text-fg">{day.name}</strong>
          {day.blocks.map((block) => (
            <div key={block.id} className="mt-1.5 ml-1">
              <div>
                <span className="text-fg">{block.training_method.name}</span>{' '}
                <span className="hint">— {describeMethod(block.training_method)}</span>
              </div>
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {block.exercises.map((ex, idx) => (
                  <li key={ex.id} className="pl-3 text-sm text-fg">
                    {block.training_method.scope === 'pair' && (
                      <span className="hint">{idx % 2 === 0 ? 'heavy: ' : 'light: '}</span>
                    )}
                    {ex.exercise_name}
                    {ex.reps_min != null && ex.reps_max != null && (
                      <span className="hint">
                        {' '}
                        · {ex.reps_min}–{ex.reps_max} reps
                      </span>
                    )}
                    {ex.note && <span className="hint"> · {ex.note}</span>}
                    {ex.is_unilateral_active && <span className="hint"> · unilateral</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
