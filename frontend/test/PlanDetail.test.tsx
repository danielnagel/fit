import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PlanDetail from '../src/PlanDetail';
import type { PlanDetailData } from '../src/PlanDetail';
import type { TrainingMethod } from '../src/trainingMethods';

function method(overrides: Partial<TrainingMethod> = {}): TrainingMethod {
  return {
    id: 1,
    name: 'Zirkel',
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
    const plan: PlanDetailData = { id: 1, name: 'Leerer Plan', days: [] };
    render(<PlanDetail plan={plan} />);
    expect(screen.getByText('Dieser Plan hat noch keine Trainingstage.')).toBeInTheDocument();
  });

  it('renders days, blocks and exercises', () => {
    const plan: PlanDetailData = {
      id: 1,
      name: 'Ganzkörper',
      days: [
        {
          id: 10,
          name: 'Tag A',
          blocks: [
            {
              id: 100,
              training_method: method({ id: 1, name: 'Zirkel' }),
              exercises: [
                { id: 1000, exercise_name: 'Kniebeuge', reps_min: 6, reps_max: 12, note: 'tief', is_unilateral_active: false },
                {
                  id: 1001,
                  exercise_name: 'Liegestütz',
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

    expect(screen.getByText('Tag A')).toBeInTheDocument();
    expect(screen.getByText('Zirkel')).toBeInTheDocument();
    expect(screen.getByText('Kniebeuge', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Liegestütz', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('6–12 Wdh.', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('tief', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('einseitig', { exact: false })).toBeInTheDocument();
  });

  it('labels pair-scope exercises as schwer/leicht', () => {
    const plan: PlanDetailData = {
      id: 2,
      name: 'Superset-Plan',
      days: [
        {
          id: 20,
          name: 'Tag B',
          blocks: [
            {
              id: 200,
              training_method: method({ id: 2, name: 'Superset', scope: 'pair' }),
              exercises: [
                { id: 2000, exercise_name: 'Bankdrücken', reps_min: 6, reps_max: 10, note: null, is_unilateral_active: false },
                { id: 2001, exercise_name: 'Rudern', reps_min: 6, reps_max: 10, note: null, is_unilateral_active: false },
              ],
            },
          ],
        },
      ],
    };

    render(<PlanDetail plan={plan} />);

    expect(screen.getByText('schwer:', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('leicht:', { exact: false })).toBeInTheDocument();
  });
});
