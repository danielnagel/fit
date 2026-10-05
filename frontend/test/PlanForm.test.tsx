import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlanForm from '../src/PlanForm';
import type { TrainingMethod } from '../src/trainingMethods';

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => body } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const methodSingle: TrainingMethod = {
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
};

const methodPair: TrainingMethod = {
  id: 2,
  name: 'Superset',
  scope: 'pair',
  timing_family: 'fixed-window-remainder',
  window_seconds: 240,
  work_seconds: null,
  rest_seconds: null,
  rest_formula: null,
  rest_factor: null,
  stop_condition: 'fixed-count',
  rounds: 3,
  total_duration_seconds: null,
};

const methodHiit: TrainingMethod = {
  id: 4,
  name: 'High-intensity set',
  scope: 'single',
  timing_family: 'fixed-work-rest',
  window_seconds: null,
  work_seconds: 20,
  rest_seconds: 10,
  rest_formula: null,
  rest_factor: null,
  stop_condition: 'fixed-count',
  rounds: 8,
  total_duration_seconds: null,
};

const methodStufensatz: TrainingMethod = {
  id: 5,
  name: 'Ladder set',
  scope: 'single',
  timing_family: 'self-paced',
  window_seconds: null,
  work_seconds: null,
  rest_seconds: null,
  rest_formula: 'proportional',
  rest_factor: 1,
  stop_condition: 'time-budget',
  rounds: null,
  total_duration_seconds: 450,
};

const methodZirkel: TrainingMethod = {
  id: 6,
  name: 'Circuit interval',
  scope: 'all',
  timing_family: 'self-paced',
  window_seconds: null,
  work_seconds: null,
  rest_seconds: null,
  rest_formula: 'proportional',
  rest_factor: 0.5,
  stop_condition: 'time-budget',
  rounds: null,
  total_duration_seconds: 1200,
};

const methodPairWindow: TrainingMethod = {
  id: 3,
  name: 'Superset',
  scope: 'pair',
  timing_family: 'fixed-window-remainder',
  window_seconds: 240,
  work_seconds: null,
  rest_seconds: null,
  rest_formula: null,
  rest_factor: null,
  stop_condition: 'fixed-count',
  rounds: 2,
  total_duration_seconds: null,
};

const exercises = [
  { id: 1, name: 'Squat', is_unilateral: false },
  { id: 2, name: 'Push-up', is_unilateral: false },
  { id: 3, name: 'Bench press', is_unilateral: false },
  { id: 4, name: 'Row', is_unilateral: false },
  { id: 5, name: 'One-arm row', is_unilateral: true },
  { id: 6, name: 'One-arm dumbbell press', is_unilateral: true },
];

describe('PlanForm', () => {
  it('builds the expected POST body for a new plan with a single and a pair block', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse([methodSingle, methodPair]));

    render(<PlanForm exercises={exercises} onDone={onDone} onCancel={vi.fn()} />);

    await screen.findByLabelText('Name');
    await user.type(screen.getByLabelText('Name'), 'Test plan');
    await user.type(screen.getByPlaceholderText('Training day name'), 'Day 1');

    // Block 1 (default: single-scope method) — pick an exercise and fill reps + note.
    let combos = screen.getAllByRole('combobox');
    await user.selectOptions(combos[1], 'Squat');
    await user.type(screen.getAllByLabelText('Reps from')[0], '8');
    await user.type(screen.getAllByLabelText('to')[0], '10');
    await user.type(screen.getByPlaceholderText('Variant (optional, e.g. 3 s hold at the bottom)'), 'langsam');

    // Add a second block and switch it to the pair-scope method.
    await user.click(screen.getByRole('button', { name: 'Add block' }));
    combos = screen.getAllByRole('combobox');
    expect(combos).toHaveLength(4); // block1 method+exercise, block2 method+exercise
    await user.selectOptions(combos[2], 'Superset');

    combos = screen.getAllByRole('combobox');
    expect(combos).toHaveLength(5); // pair method now has two exercise slots
    expect(screen.getByText('heavy')).toBeInTheDocument();
    expect(screen.getByText('light')).toBeInTheDocument();
    await user.selectOptions(combos[3], 'Bench press');
    await user.selectOptions(combos[4], 'Row');

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 99 }, true, 201));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test plan',
        days: [
          {
            name: 'Day 1',
            blocks: [
              {
                training_method_id: 1,
                exercises: [{ exercise_id: 1, reps_min: 8, reps_max: 10, note: 'langsam', is_unilateral_active: false }],
              },
              {
                training_method_id: 2,
                exercises: [
                  { exercise_id: 3, reps_min: 1, reps_max: 5, note: null, is_unilateral_active: false },
                  { exercise_id: 4, reps_min: 6, reps_max: 12, note: null, is_unilateral_active: false },
                ],
              },
            ],
          },
        ],
      }),
    });
  });

  it('loads an existing plan pre-filled for editing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([methodSingle, methodPair]));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 7,
        name: 'Existing plan',
        days: [
          {
            id: 10,
            name: 'Day A',
            blocks: [
              {
                id: 100,
                training_method: methodPair,
                exercises: [
                  { exercise_id: 3, reps_min: 5, reps_max: 9, note: 'heavy variante' },
                  { exercise_id: 4, reps_min: 5, reps_max: 9, note: null },
                ],
              },
            ],
          },
        ],
      }),
    );

    render(<PlanForm planId={7} exercises={exercises} onDone={vi.fn()} onCancel={vi.fn()} />);

    expect(await screen.findByDisplayValue('Existing plan')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Day A')).toBeInTheDocument();

    const combos = screen.getAllByRole('combobox');
    expect(combos[0]).toHaveValue(String(methodPair.id));
    expect(combos[1]).toHaveValue('3');
    expect(combos[2]).toHaveValue('4');

    expect(screen.getAllByLabelText('Reps from')[0]).toHaveValue(5);
    expect(screen.getAllByLabelText('to')[0]).toHaveValue(9);
    expect(screen.getByDisplayValue('heavy variante')).toBeInTheDocument();
  });

  it('hides the reps inputs for fixed-work-rest (High-intensity set) blocks, submitting null reps', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([methodHiit]));

    render(<PlanForm exercises={exercises} onDone={vi.fn()} onCancel={vi.fn()} />);

    await screen.findByLabelText('Name');
    await user.type(screen.getByLabelText('Name'), 'Test plan');
    await user.type(screen.getByPlaceholderText('Training day name'), 'Day 1');
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'Squat');

    expect(screen.queryByLabelText('Reps from')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('to')).not.toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 99 }, true, 201));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/plans',
      expect.objectContaining({
        body: JSON.stringify({
          name: 'Test plan',
          days: [
            {
              name: 'Day 1',
              blocks: [
                {
                  training_method_id: 4,
                  exercises: [{ exercise_id: 1, reps_min: null, reps_max: null, note: null, is_unilateral_active: false }],
                },
              ],
            },
          ],
        }),
      }),
    );
  });

  it('only offers the unilateral checkbox for unilateral exercises in fixed-window-remainder blocks, and resets it on exercise change', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([methodSingle, methodPair]));

    render(<PlanForm exercises={exercises} onDone={vi.fn()} onCancel={vi.fn()} />);

    await screen.findByLabelText('Name');
    await user.type(screen.getByPlaceholderText('Training day name'), 'Day 1');

    // methodSingle is fixed-window-remainder, but the default exercise slot is empty -> no checkbox yet.
    expect(screen.queryByLabelText('unilateral')).not.toBeInTheDocument();

    const combos = screen.getAllByRole('combobox');
    await user.selectOptions(combos[1], 'Squat');
    expect(screen.queryByLabelText('unilateral')).not.toBeInTheDocument();

    await user.selectOptions(combos[1], 'One-arm row');
    await user.click(screen.getByLabelText('unilateral'));

    await user.selectOptions(combos[1], 'Squat');
    expect(screen.queryByLabelText('unilateral')).not.toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 99 }, true, 201));
    await user.type(screen.getByLabelText('Name'), 'Test plan');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/plans',
      expect.objectContaining({
        body: expect.stringContaining('"is_unilateral_active":false'),
      }),
    );
  });

  it('also offers the unilateral checkbox for Ladder set and High-intensity set, but not for Circuit interval', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([methodStufensatz, methodHiit, methodZirkel]));

    render(<PlanForm exercises={exercises} onDone={vi.fn()} onCancel={vi.fn()} />);

    await screen.findByLabelText('Name');
    await user.type(screen.getByPlaceholderText('Training day name'), 'Day 1');

    // Default block uses methodStufensatz (self-paced, scope 'single').
    let combos = screen.getAllByRole('combobox');
    await user.selectOptions(combos[1], 'One-arm row');
    expect(screen.getByLabelText('unilateral')).toBeInTheDocument();

    // Switch to the fixed-work-rest method -> still offered.
    await user.selectOptions(combos[0], 'High-intensity set');
    combos = screen.getAllByRole('combobox');
    await user.selectOptions(combos[1], 'One-arm row');
    expect(screen.getByLabelText('unilateral')).toBeInTheDocument();

    // Switch to Zirkel-Intervall (self-paced, scope 'all') -> not offered.
    await user.selectOptions(combos[0], 'Circuit interval');
    combos = screen.getAllByRole('combobox');
    await user.selectOptions(combos[1], 'One-arm row');
    expect(screen.queryByLabelText('unilateral')).not.toBeInTheDocument();
  });

  it('activates unilateral independently per exercise in a pair-scope fixed-window-remainder block', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([methodPairWindow]));

    render(<PlanForm exercises={exercises} onDone={vi.fn()} onCancel={vi.fn()} />);

    await screen.findByLabelText('Name');
    await user.type(screen.getByLabelText('Name'), 'Test plan');
    await user.type(screen.getByPlaceholderText('Training day name'), 'Day 1');

    const combos = screen.getAllByRole('combobox');
    await user.selectOptions(combos[1], 'One-arm row');
    await user.selectOptions(combos[2], 'One-arm dumbbell press');

    const checkboxes = screen.getAllByLabelText('unilateral');
    expect(checkboxes).toHaveLength(2);
    await user.click(checkboxes[0]);

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 99 }, true, 201));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/plans',
      expect.objectContaining({
        body: JSON.stringify({
          name: 'Test plan',
          days: [
            {
              name: 'Day 1',
              blocks: [
                {
                  training_method_id: 3,
                  exercises: [
                    { exercise_id: 5, reps_min: 1, reps_max: 5, note: null, is_unilateral_active: true },
                    { exercise_id: 6, reps_min: 6, reps_max: 12, note: null, is_unilateral_active: false },
                  ],
                },
              ],
            },
          ],
        }),
      }),
    );
  });

  it('shows the server error message when submitting a new plan fails', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([methodSingle]));

    render(<PlanForm exercises={exercises} onDone={vi.fn()} onCancel={vi.fn()} />);

    await screen.findByLabelText('Name');
    await user.type(screen.getByLabelText('Name'), 'Test plan');
    await user.type(screen.getByPlaceholderText('Training day name'), 'Day 1');
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'Squat');

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Invalid data' }, false, 400));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Error: Invalid data')).toBeInTheDocument();
  });
});
