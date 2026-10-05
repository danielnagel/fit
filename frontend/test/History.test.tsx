import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import History from '../src/History';

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

const session101 = {
  id: 101,
  plan_day_id: 5,
  plan_week_id: 1,
  plan_id: 1,
  plan_name: 'Strength plan',
  week_started_at: '2026-01-05T00:00:00.000Z',
  day_snapshot: { name: 'Day A', blocks: [{ training_method: { name: 'Strength' } }] },
  status: 'completed' as const,
  started_at: '2026-01-05T10:00:00.000Z',
  completed_at: '2026-01-05T11:00:00.000Z',
};

function renderHistory() {
  return render(
    <MemoryRouter>
      <History />
    </MemoryRouter>,
  );
}

describe('History', () => {
  it('shows an empty state when there are no sessions', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    renderHistory();

    expect(await screen.findByText('No trainings done yet.')).toBeInTheDocument();
  });

  it('groups sessions by week and expands/collapses the week', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([session101]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    renderHistory();

    await screen.findByText('Strength plan');
    expect(screen.queryByText('Day A')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show week' }));

    expect(screen.getByText('Day A')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide week' }));

    expect(screen.queryByText('Day A')).not.toBeInTheDocument();
  });

  it('expands session details and lists logged sets', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([session101]));
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 7, name: 'Squat' }]));

    renderHistory();

    await screen.findByText('Strength plan');
    await user.click(screen.getByRole('button', { name: 'Show week' }));

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...session101,
        logged_sets: [
          {
            id: 1,
            exercise_id: 7,
            unit_index: 0,
            reps: 10,
            completed_seconds: null,
            side: 'left',
            performed_at: '2026-01-05T10:05:00.000Z',
          },
        ],
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Details' }));

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Squat')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Reps' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Side' })).toBeInTheDocument();
    const row = within(table).getByText('Squat').closest('tr')!;
    expect(within(row).getByText('10')).toBeInTheDocument();
    expect(within(row).getByText('1')).toBeInTheDocument();
    expect(within(row).getByText('left')).toBeInTheDocument();
  });

  it('loads and displays the progress chart for a selected exercise', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 7, name: 'Squat' }]));

    renderHistory();

    const select = await screen.findByLabelText('Exercise');

    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { training_session_id: 1, performed_at: '2026-01-05T10:00:00.000Z', max_reps: 10, total_reps: 30, set_count: 3 },
      ]),
    );

    await user.selectOptions(select, '7');

    expect(await screen.findByRole('img', { name: /Progress/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/exercises/7/progress');
  });

  it('deletes a session after confirming the dialog', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([session101]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    renderHistory();

    await screen.findByText('Strength plan');
    await user.click(screen.getByRole('button', { name: 'Show week' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByText('Permanently delete this training? This cannot be undone.')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined } as Response);
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const confirmButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(screen.queryByText('Strength plan')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/sessions/101', expect.objectContaining({ method: 'DELETE' }));
  });
});
