import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Exercises from '../src/Exercises';

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

describe('Exercises', () => {
  it('loads and displays exercises', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ id: 1, name: 'Kniebeuge', description: 'tief', created_at: '2026-01-01' }]),
    );

    render(<Exercises />);

    expect(await screen.findByText('Kniebeuge')).toBeInTheDocument();
    expect(screen.getByText('– tief')).toBeInTheDocument();
  });

  it('adds a new exercise and reloads the list', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Exercises />);
    await screen.findByRole('button', { name: 'Hinzufügen' });

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1, name: 'Klimmzug', description: '' }, true, 201));
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ id: 1, name: 'Klimmzug', description: null, created_at: '2026-01-01' }]),
    );

    await user.type(screen.getByPlaceholderText('Name'), 'Klimmzug');
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    expect(await screen.findByText('Klimmzug')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/exercises',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('creates an exercise marked as unilateral and shows the hint', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Exercises />);
    await screen.findByRole('button', { name: 'Hinzufügen' });

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1, name: 'Einarmiges Rudern', is_unilateral: true }, true, 201));
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { id: 1, name: 'Einarmiges Rudern', description: null, is_unilateral: true, created_at: '2026-01-01' },
      ]),
    );

    await user.type(screen.getByPlaceholderText('Name'), 'Einarmiges Rudern');
    await user.click(screen.getByLabelText('kann einseitig ausgeführt werden'));
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    expect(await screen.findByText('Einarmiges Rudern')).toBeInTheDocument();
    expect(screen.getByText('· einseitig')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/exercises',
      expect.objectContaining({ body: JSON.stringify({ name: 'Einarmiges Rudern', description: '', is_unilateral: true }) }),
    );
  });

  it('shows the server error message when creating fails', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Exercises />);
    await screen.findByRole('button', { name: 'Hinzufügen' });

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Übung existiert bereits' }, false, 409));

    await user.type(screen.getByPlaceholderText('Name'), 'Duplikat');
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    expect(await screen.findByText('Fehler: Übung existiert bereits')).toBeInTheDocument();
  });

  it('edits an exercise in place', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ id: 1, name: 'Alt', description: null, created_at: '2026-01-01' }]),
    );
    render(<Exercises />);
    await screen.findByText('Alt');

    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }));

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1, name: 'Neu', description: null }, true, 200));
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ id: 1, name: 'Neu', description: null, created_at: '2026-01-01' }]),
    );

    const nameInput = screen.getByDisplayValue('Alt');
    await user.clear(nameInput);
    await user.type(nameInput, 'Neu');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Neu')).toBeInTheDocument();
  });

  it('deletes an exercise after confirming the dialog', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ id: 1, name: 'Zu löschen', description: null, created_at: '2026-01-01' }]),
    );
    render(<Exercises />);
    const item = await screen.findByText('Zu löschen');

    await user.click(within(item.closest('li')!).getByRole('button', { name: 'Löschen' }));

    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined } as Response);
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const confirmButtons = screen.getAllByRole('button', { name: 'Löschen' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(screen.queryByText('Zu löschen')).not.toBeInTheDocument());
  });
});
