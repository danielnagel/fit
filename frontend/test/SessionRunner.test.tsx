import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SessionRunner from '../src/SessionRunner';
import { blockFixture, exerciseFixture, methodFixture, sessionFixture } from './testSupport/sessionFixtures';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  // Fallback fuer Aufrufe, die ein Test nicht gezielt mockt (z.B. der Timer-Anker-PUT,
  // den FixedWindowUnitRunner beim Mount abschickt).
  fetchMock.mockResolvedValue(jsonResponse({}));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('SessionRunner', () => {
  it('loads the session and renders the active block', async () => {
    const session = sessionFixture({
      day_snapshot: { name: 'Push Day', blocks: [blockFixture({ training_method: methodFixture({ name: 'Intervallsatz' }) })] },
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(session));

    render(<SessionRunner sessionId={session.id} onFinished={vi.fn()} />);
    await act(async () => {});

    expect(screen.getByText('Push Day')).toBeInTheDocument();
    expect(screen.getByText(/Block 1\/1 \(Intervallsatz\)/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/sessions/${session.id}`);
  });

  it('shows which exercise of the block is currently active when the block has more than one', async () => {
    const session = sessionFixture({
      day_snapshot: {
        name: 'Push Day',
        blocks: [
          blockFixture({
            training_method: methodFixture({ name: 'Intervallsatz', scope: 'single', stop_condition: 'fixed-count', rounds: 1 }),
            exercises: [exerciseFixture(1), exerciseFixture(2), exerciseFixture(3), exerciseFixture(4)],
          }),
        ],
      },
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(session));

    render(<SessionRunner sessionId={session.id} onFinished={vi.fn()} />);
    await act(async () => {});

    expect(screen.getByText(/Übung 1\/4/)).toBeInTheDocument();
  });

  it('shows the fetch error message when loading fails', async () => {
    fetchMock.mockReset();
    fetchMock.mockRejectedValueOnce(new Error('Netzwerkfehler'));

    render(<SessionRunner sessionId={1} onFinished={vi.fn()} />);
    await act(async () => {});

    expect(screen.getByText(/Fehler: Error: Netzwerkfehler/)).toBeInTheDocument();
  });

  it('automatically completes the session once every block is done', async () => {
    const onFinished = vi.fn();
    const session = sessionFixture({ day_snapshot: { name: 'Leerer Tag', blocks: [] } });
    fetchMock.mockResolvedValueOnce(jsonResponse(session));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...session, status: 'completed' }));

    render(<SessionRunner sessionId={session.id} onFinished={onFinished} />);
    await act(async () => {});

    expect(screen.getByText('Training abgeschlossen.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/sessions/${session.id}`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'completed' }) }),
    );
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('aborts the session after confirming the dialog', async () => {
    const onFinished = vi.fn();
    const session = sessionFixture({
      day_snapshot: { name: 'Push Day', blocks: [blockFixture({ training_method: methodFixture({ name: 'Intervallsatz' }) })] },
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(session));
    render(<SessionRunner sessionId={session.id} onFinished={onFinished} />);
    await act(async () => {});
    expect(screen.getByText('Push Day')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(jsonResponse({ ...session, status: 'aborted' }));

    fireEvent.click(screen.getByRole('button', { name: 'Training abbrechen' }));
    const confirmButtons = screen.getAllByRole('button', { name: 'Abbrechen' });
    await act(async () => {
      fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/sessions/${session.id}`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'aborted' }) }),
    );
    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
