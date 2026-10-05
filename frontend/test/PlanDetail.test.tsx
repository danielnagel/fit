import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PlanDetail from '../src/PlanDetail';
import type { PlanDetailData } from '../src/PlanDetail';
import type { TrainingMethod } from '../src/trainingMethods';

function method(overrides: Partial<TrainingMethod> = {}): TrainingMethod {
  return {
    id: 1,
    name: 'Circuit',
    scope: 'single',
    timing_family: 'fixed-window-remainder',
    window_seconds: 180,
    work_seconds: null,
    rest_seconds: null,
    rest_formula: null,
    rest_factor: null,
    stop_condition: 'fixed-count',
    rounds: 3,
    total_duration_seconds: null,
    ...overrides,
  };
}

describe('PlanDetail', () => {
  it('shows a hint when the plan has no training days', () => {
    const plan: PlanDetailData = { id: 1, name: 'Empty plan', days: [] };
    render(<PlanDetail plan={plan} />);
    expect(screen.getByText("This plan doesn't have any training days yet.")).toBeInTheDocument();
  });

  it('renders days, blocks and exercises', () => {
    const plan: PlanDetailData = {
      id: 1,
      name: 'Full body',
      days: [
        {
          id: 10,
          name: 'Day A',
          blocks: [
            {
              id: 100,
              training_method: method({ id: 1, name: 'Circuit' }),
              exercises: [
                { id: 1000, exercise_name: 'Squat', reps_min: 6, reps_max: 12, note: 'deep', is_unilateral_active: false },
                {
                  id: 1001,
                  exercise_name: 'Push-up',
                  reps_min: null,
                  reps_max: null,
                  note: null,
                  is_unilateral_active: true,
                },
              ],
            },
          ],
        },
      ],
    };

    render(<PlanDetail plan={plan} />);

    expect(screen.getByText('Day A')).toBeInTheDocument();
    expect(screen.getByText('Circuit')).toBeInTheDocument();
    expect(screen.getByText('Squat', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Push-up', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('6–12 reps', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('deep', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('unilateral', { exact: false })).toBeInTheDocument();
  });

  it('labels pair-scope exercises as heavy/light', () => {
    const plan: PlanDetailData = {
      id: 2,
      name: 'Superset plan',
      days: [
        {
          id: 20,
          name: 'Day B',
          blocks: [
            {
              id: 200,
              training_method: method({ id: 2, name: 'Superset', scope: 'pair' }),
              exercises: [
                { id: 2000, exercise_name: 'Bench press', reps_min: 6, reps_max: 10, note: null, is_unilateral_active: false },
                { id: 2001, exercise_name: 'Row', reps_min: 6, reps_max: 10, note: null, is_unilateral_active: false },
              ],
            },
          ],
        },
      ],
    };

    render(<PlanDetail plan={plan} />);

    expect(screen.getByText('heavy:', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('light:', { exact: false })).toBeInTheDocument();
  });
});
