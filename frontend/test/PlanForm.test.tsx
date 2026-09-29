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
  name: 'Hochintensitaetssatz',
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
  name: 'Stufensatz',
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
  name: 'Zirkel-Intervall',
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
  name: 'Supersatz',
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
  { id: 1, name: 'Kniebeuge', is_unilateral: false },
  { id: 2, name: 'Liegestütz', is_unilateral: false },
  { id: 3, name: 'Bankdrücken', is_unilateral: false },
  { id: 4, name: 'Rudern', is_unilateral: false },
  { id: 5, name: 'Einarmiges Rudern', is_unilateral: true },
  { id: 6, name: 'Einarmiges Kurzhanteldrücken', is_unilateral: true },
];

describe('PlanForm', () => {
  it('builds the expected POST body for a new plan with a single and a pair block', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse([methodSingle, methodPair]));

    render(<PlanForm exercises={exercises} onDone={onDone} onCancel={vi.fn()} />);

    await screen.findByLabelText('Name');
    await user.type(screen.getByLabelText('Name'), 'Testplan');
    await user.type(screen.getByPlaceholderText('Trainingstag-Name'), 'Tag 1');

    // Block 1 (default: single-scope method) — pick an exercise and fill reps + note.
    let combos = screen.getAllByRole('combobox');
    await user.selectOptions(combos[1], 'Kniebeuge');
    await user.type(screen.getAllByLabelText('Wdh. von')[0], '8');
    await user.type(screen.getAllByLabelText('bis')[0], '10');
    await user.type(screen.getByPlaceholderText('Variante (optional, z. B. 3 Sek. Haltezeit am tiefsten Punkt)'), 'langsam');

    // Add a second block and switch it to the pair-scope method.
    await user.click(screen.getByRole('button', { name: 'Block hinzufügen' }));
    combos = screen.getAllByRole('combobox');
    expect(combos).toHaveLength(4); // block1 method+exercise, block2 method+exercise
    await user.selectOptions(combos[2], 'Superset');

    combos = screen.getAllByRole('combobox');
    expect(combos).toHaveLength(5); // pair method now has two exercise slots
    expect(screen.getByText('schwer')).toBeInTheDocument();
    expect(screen.getByText('leicht')).toBeInTheDocument();
    await user.selectOptions(combos[3], 'Bankdrücken');
    await user.selectOptions(combos[4], 'Rudern');

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 99 }, true, 201));

    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Testplan',
        days: [
          {
            name: 'Tag 1',
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
        name: 'Bestehender Plan',
        days: [
          {
            id: 10,
            name: 'Tag A',
            blocks: [
              {
                id: 100,
                training_method: methodPair,
                exercises: [
                  { exercise_id: 3, reps_min: 5, reps_max: 9, note: 'schwer variante' },
                  { exercise_id: 4, reps_min: 5, reps_max: 9, note: null },
                ],
              },
            ],
          },
        ],
      }),
    );

    render(<PlanForm planId={7} exercises={exercises} onDone={vi.fn()} onCancel={vi.fn()} />);

    expect(await screen.findByDisplayValue('Bestehender Plan')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Tag A')).toBeInTheDocument();

    const combos = screen.getAllByRole('combobox');
    expect(combos[0]).toHaveValue(String(methodPair.id));
    expect(combos[1]).toHaveValue('3');
    expect(combos[2]).toHaveValue('4');

    expect(screen.getAllByLabelText('Wdh. von')[0]).toHaveValue(5);
    expect(screen.getAllByLabelText('bis')[0]).toHaveValue(9);
    expect(screen.getByDisplayValue('schwer variante')).toBeInTheDocument();
  });

  it('hides the reps inputs for fixed-work-rest (Hochintensitätssatz) blocks, submitting null reps', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([methodHiit]));

    render(<PlanForm exercises={exercises} onDone={vi.fn()} onCancel={vi.fn()} />);

    await screen.findByLabelText('Name');
    await user.type(screen.getByLabelText('Name'), 'Testplan');
    await user.type(screen.getByPlaceholderText('Trainingstag-Name'), 'Tag 1');
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'Kniebeuge');

    expect(screen.queryByLabelText('Wdh. von')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('bis')).not.toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 99 }, true, 201));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/plans',
      expect.objectContaining({
        body: JSON.stringify({
          name: 'Testplan',
          days: [
            {
              name: 'Tag 1',
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

  it('only offers the einseitig checkbox for unilateral exercises in fixed-window-remainder blocks, and resets it on exercise change', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([methodSingle, methodPair]));

    render(<PlanForm exercises={exercises} onDone={vi.fn()} onCancel={vi.fn()} />);

    await screen.findByLabelText('Name');
    await user.type(screen.getByPlaceholderText('Trainingstag-Name'), 'Tag 1');

    // methodSingle is fixed-window-remainder, but the default exercise slot is empty -> no checkbox yet.
    expect(screen.queryByLabelText('einseitig')).not.toBeInTheDocument();

    const combos = screen.getAllByRole('combobox');
    await user.selectOptions(combos[1], 'Kniebeuge');
    expect(screen.queryByLabelText('einseitig')).not.toBeInTheDocument();

    await user.selectOptions(combos[1], 'Einarmiges Rudern');
    await user.click(screen.getByLabelText('einseitig'));

    await user.selectOptions(combos[1], 'Kniebeuge');
    expect(screen.queryByLabelText('einseitig')).not.toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 99 }, true, 201));
    await user.type(screen.getByLabelText('Name'), 'Testplan');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/plans',
      expect.objectContaining({
        body: expect.stringContaining('"is_unilateral_active":false'),
      }),
    );
  });

  it('also offers the einseitig checkbox for Stufensatz and Hochintensitätssatz, but not for Zirkel-Intervall', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([methodStufensatz, methodHiit, methodZirkel]));

    render(<PlanForm exercises={exercises} onDone={vi.fn()} onCancel={vi.fn()} />);

    await screen.findByLabelText('Name');
    await user.type(screen.getByPlaceholderText('Trainingstag-Name'), 'Tag 1');

    // Default block uses methodStufensatz (self-paced, scope 'single').
    let combos = screen.getAllByRole('combobox');
    await user.selectOptions(combos[1], 'Einarmiges Rudern');
    expect(screen.getByLabelText('einseitig')).toBeInTheDocument();

    // Switch to the fixed-work-rest method -> still offered.
    await user.selectOptions(combos[0], 'Hochintensitaetssatz');
    combos = screen.getAllByRole('combobox');
    await user.selectOptions(combos[1], 'Einarmiges Rudern');
    expect(screen.getByLabelText('einseitig')).toBeInTheDocument();

    // Switch to Zirkel-Intervall (self-paced, scope 'all') -> not offered.
    await user.selectOptions(combos[0], 'Zirkel-Intervall');
    combos = screen.getAllByRole('combobox');
    await user.selectOptions(combos[1], 'Einarmiges Rudern');
    expect(screen.queryByLabelText('einseitig')).not.toBeInTheDocument();
  });

  it('activates einseitig independently per exercise in a pair-scope fixed-window-remainder block', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([methodPairWindow]));

    render(<PlanForm exercises={exercises} onDone={vi.fn()} onCancel={vi.fn()} />);

    await screen.findByLabelText('Name');
    await user.type(screen.getByLabelText('Name'), 'Testplan');
    await user.type(screen.getByPlaceholderText('Trainingstag-Name'), 'Tag 1');

    const combos = screen.getAllByRole('combobox');
    await user.selectOptions(combos[1], 'Einarmiges Rudern');
    await user.selectOptions(combos[2], 'Einarmiges Kurzhanteldrücken');

    const checkboxes = screen.getAllByLabelText('einseitig');
    expect(checkboxes).toHaveLength(2);
    await user.click(checkboxes[0]);

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 99 }, true, 201));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/plans',
      expect.objectContaining({
        body: JSON.stringify({
          name: 'Testplan',
          days: [
            {
              name: 'Tag 1',
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
    await user.type(screen.getByLabelText('Name'), 'Testplan');
    await user.type(screen.getByPlaceholderText('Trainingstag-Name'), 'Tag 1');
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'Kniebeuge');

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Ungültige Daten' }, false, 400));

    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Fehler: Ungültige Daten')).toBeInTheDocument();
  });
});
