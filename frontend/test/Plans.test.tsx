import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Plans from '../src/Plans';

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

const plan = { id: 1, name: 'Ganzkörper', day_count: 2 };

const planDetail = {
  id: 1,
  name: 'Ganzkörper',
  days: [
    {
      id: 10,
      name: 'Tag A',
      blocks: [
        {
          id: 100,
          training_method: {
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
          },
          exercises: [{ id: 1000, exercise_name: 'Kniebeuge', reps_min: 6, reps_max: 12, note: null }],
        },
      ],
    },
  ],
};

describe('Plans', () => {
  it('loads and displays the list of plans', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([plan]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    render(<Plans />);

    expect(await screen.findByText('Ganzkörper')).toBeInTheDocument();
    expect(screen.getByText('– 2 Trainingstag(e)', { exact: false })).toBeInTheDocument();
  });

  it('opens the PlanForm when "Neuer Plan" is clicked', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Plans />);
    await screen.findByRole('button', { name: 'Neuer Plan' });

    fetchMock.mockResolvedValueOnce(jsonResponse([])); // training-methods for PlanForm

    await user.click(screen.getByRole('button', { name: 'Neuer Plan' }));

    expect(await screen.findByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument();
  });

  it('expands a plan and loads its detail view', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([plan]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Plans />);
    await screen.findByText('Ganzkörper');

    fetchMock.mockResolvedValueOnce(jsonResponse(planDetail));

    await user.click(screen.getByRole('button', { name: 'Details' }));

    expect(await screen.findByText('Tag A')).toBeInTheDocument();
    expect(screen.getByText('Kniebeuge', { exact: false })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/plans/1');

    await user.click(screen.getByRole('button', { name: 'Details ausblenden' }));
    expect(screen.queryByText('Tag A')).not.toBeInTheDocument();
  });

  it('opens the PlanForm pre-filled when editing a plan', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([plan]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Plans />);
    await screen.findByText('Ganzkörper');

    fetchMock.mockResolvedValueOnce(jsonResponse([planDetail.days[0].blocks[0].training_method])); // training-methods
    fetchMock.mockResolvedValueOnce(jsonResponse(planDetail)); // plan detail for edit

    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }));

    expect(await screen.findByDisplayValue('Ganzkörper')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Tag A')).toBeInTheDocument();
  });

  it('deletes a plan after confirming the dialog', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([plan]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Plans />);
    const item = await screen.findByText('Ganzkörper');
    const li = item.closest('li')!;

    await user.click(within(li).getByRole('button', { name: 'Löschen' }));

    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined } as Response);
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const confirmButtons = screen.getAllByRole('button', { name: 'Löschen' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(fetchMock).toHaveBeenCalledWith('/api/plans/1', expect.objectContaining({ method: 'DELETE' }));
    await screen.findByText('Neuer Plan');
    expect(screen.queryByText('Ganzkörper')).not.toBeInTheDocument();
  });

  it('shows an error when deleting a plan fails', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([plan]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Plans />);
    const item = await screen.findByText('Ganzkörper');
    const li = item.closest('li')!;

    await user.click(within(li).getByRole('button', { name: 'Löschen' }));

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Plan wird noch verwendet' }, false, 409));

    const confirmButtons = screen.getAllByRole('button', { name: 'Löschen' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(await screen.findByText('Fehler: Plan wird noch verwendet')).toBeInTheDocument();
    expect(screen.getByText('Ganzkörper')).toBeInTheDocument();
  });
});
