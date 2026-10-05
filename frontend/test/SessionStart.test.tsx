import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SessionStart from '../src/SessionStart';

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

describe('SessionStart', () => {
  it('lists plans when there is no active week and starts a week', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(null));
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, name: 'Plan A', day_count: 3 }]));

    render(<SessionStart onStarted={vi.fn()} />);

    const select = await screen.findByLabelText('Plan');
    await screen.findByRole('option', { name: 'Plan A' });
    await user.selectOptions(select, '1');

    const startButton = screen.getByRole('button', { name: 'Start week' });
    expect(startButton).toBeEnabled();

    fetchMock.mockResolvedValueOnce(jsonResponse({}, true, 200));
    fetchMock.mockResolvedValueOnce(jsonResponse(null));

    await user.click(startButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/plan-weeks',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ plan_id: 1 }) }),
      ),
    );
  });

  it('selects a training day and starts a training session', async () => {
    const user = userEvent.setup();
    const onStarted = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 5,
        plan_id: 2,
        plan_name: 'Plan B',
        week_number: 1,
        started_at: '2026-01-01T00:00:00.000Z',
        sessions: [],
      }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ days: [{ id: 10, name: 'Day A', blocks: [{ training_method: { name: 'Strength' } }] }] }),
    );

    render(<SessionStart onStarted={onStarted} />);

    const daySelect = await screen.findByLabelText('Training day');
    await user.selectOptions(daySelect, '10');

    const startButton = screen.getByRole('button', { name: 'Start training' });
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 99 }, true, 201));

    await user.click(startButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/sessions',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ plan_day_id: 10 }) }),
      ),
    );
    expect(onStarted).toHaveBeenCalledWith(99);
  });

  it('offers to resume an in-progress session instead of starting a new one', async () => {
    const user = userEvent.setup();
    const onStarted = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 5,
        plan_id: 2,
        plan_name: 'Plan B',
        week_number: 1,
        started_at: '2026-01-01T00:00:00.000Z',
        sessions: [{ id: 77, plan_day_id: 10, status: 'in_progress' }],
      }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ days: [{ id: 10, name: 'Day A', blocks: [{ training_method: { name: 'Strength' } }] }] }),
    );

    render(<SessionStart onStarted={onStarted} />);

    const daySelect = await screen.findByLabelText('Training day');
    await user.selectOptions(daySelect, '10');

    expect(screen.queryByRole('button', { name: 'Start training' })).not.toBeInTheDocument();
    const resumeButton = screen.getByRole('button', { name: 'Resume (in progress)' });

    const callsBefore = fetchMock.mock.calls.length;
    await user.click(resumeButton);

    expect(onStarted).toHaveBeenCalledWith(77);
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('ends the current week after confirming the dialog', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 5,
        plan_id: 2,
        plan_name: 'Plan B',
        week_number: 1,
        started_at: '2026-01-01T00:00:00.000Z',
        sessions: [],
      }),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ days: [] }));

    render(<SessionStart onStarted={vi.fn()} />);

    await screen.findByText('Plan B');
    await user.click(screen.getByRole('button', { name: 'End week' }));

    expect(screen.getByText('Really end the week?')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(jsonResponse({}, true, 200));
    fetchMock.mockResolvedValueOnce(jsonResponse(null));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await user.click(screen.getByRole('button', { name: 'End' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/plan-weeks/5', expect.objectContaining({ method: 'PATCH' })),
    );
  });
});
