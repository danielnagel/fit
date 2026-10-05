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

const plan = { id: 1, name: 'Full body', day_count: 2 };

const planDetail = {
  id: 1,
  name: 'Full body',
  days: [
    {
      id: 10,
      name: 'Day A',
      blocks: [
        {
          id: 100,
          training_method: {
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
          },
          exercises: [{ id: 1000, exercise_name: 'Squat', reps_min: 6, reps_max: 12, note: null }],
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

    expect(await screen.findByText('Full body')).toBeInTheDocument();
    expect(screen.getByText('– 2 training days', { exact: false })).toBeInTheDocument();
  });

  it('opens the PlanForm when "New plan" is clicked', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Plans />);
    await screen.findByRole('button', { name: 'New plan' });

    fetchMock.mockResolvedValueOnce(jsonResponse([])); // training-methods for PlanForm

    await user.click(screen.getByRole('button', { name: 'New plan' }));

    expect(await screen.findByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('expands a plan and loads its detail view', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([plan]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Plans />);
    await screen.findByText('Full body');

    fetchMock.mockResolvedValueOnce(jsonResponse(planDetail));

    await user.click(screen.getByRole('button', { name: 'Details' }));

    expect(await screen.findByText('Day A')).toBeInTheDocument();
    expect(screen.getByText('Squat', { exact: false })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/plans/1');

    await user.click(screen.getByRole('button', { name: 'Hide details' }));
    expect(screen.queryByText('Day A')).not.toBeInTheDocument();
  });

  it('opens the PlanForm pre-filled when editing a plan', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([plan]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Plans />);
    await screen.findByText('Full body');

    fetchMock.mockResolvedValueOnce(jsonResponse([planDetail.days[0].blocks[0].training_method])); // training-methods
    fetchMock.mockResolvedValueOnce(jsonResponse(planDetail)); // plan detail for edit

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(await screen.findByDisplayValue('Full body')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Day A')).toBeInTheDocument();
  });

  it('deletes a plan after confirming the dialog', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([plan]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Plans />);
    const item = await screen.findByText('Full body');
    const li = item.closest('li')!;

    await user.click(within(li).getByRole('button', { name: 'Delete' }));

    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined } as Response);
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const confirmButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(fetchMock).toHaveBeenCalledWith('/api/plans/1', expect.objectContaining({ method: 'DELETE' }));
    await screen.findByText('New plan');
    expect(screen.queryByText('Full body')).not.toBeInTheDocument();
  });

  it('shows an error when deleting a plan fails', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([plan]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Plans />);
    const item = await screen.findByText('Full body');
    const li = item.closest('li')!;

    await user.click(within(li).getByRole('button', { name: 'Delete' }));

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Plan is still in use' }, false, 409));

    const confirmButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(await screen.findByText('Error: Plan is still in use')).toBeInTheDocument();
    expect(screen.getByText('Full body')).toBeInTheDocument();
  });
});
