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
      jsonResponse([{ id: 1, name: 'Squat', description: 'deep', created_at: '2026-01-01' }]),
    );

    render(<Exercises />);

    expect(await screen.findByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('– deep')).toBeInTheDocument();
  });

  it('adds a new exercise and reloads the list', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Exercises />);
    await screen.findByRole('button', { name: 'Add' });

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1, name: 'Pull-up', description: '' }, true, 201));
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ id: 1, name: 'Pull-up', description: null, created_at: '2026-01-01' }]),
    );

    await user.type(screen.getByPlaceholderText('Name'), 'Pull-up');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Pull-up')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/exercises',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('creates an exercise marked as unilateral and shows the hint', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Exercises />);
    await screen.findByRole('button', { name: 'Add' });

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1, name: 'One-arm row', is_unilateral: true }, true, 201));
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { id: 1, name: 'One-arm row', description: null, is_unilateral: true, created_at: '2026-01-01' },
      ]),
    );

    await user.type(screen.getByPlaceholderText('Name'), 'One-arm row');
    await user.click(screen.getByLabelText('can be done unilaterally'));
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('One-arm row')).toBeInTheDocument();
    expect(screen.getByText('· unilateral')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/exercises',
      expect.objectContaining({ body: JSON.stringify({ name: 'One-arm row', description: '', is_unilateral: true }) }),
    );
  });

  it('shows the server error message when creating fails', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<Exercises />);
    await screen.findByRole('button', { name: 'Add' });

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Exercise already exists' }, false, 409));

    await user.type(screen.getByPlaceholderText('Name'), 'Duplicate');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Error: Exercise already exists')).toBeInTheDocument();
  });

  it('edits an exercise in place', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ id: 1, name: 'Old', description: null, created_at: '2026-01-01' }]),
    );
    render(<Exercises />);
    await screen.findByText('Old');

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1, name: 'New', description: null }, true, 200));
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ id: 1, name: 'New', description: null, created_at: '2026-01-01' }]),
    );

    const nameInput = screen.getByDisplayValue('Old');
    await user.clear(nameInput);
    await user.type(nameInput, 'New');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('New')).toBeInTheDocument();
  });

  it('deletes an exercise after confirming the dialog', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ id: 1, name: 'To delete', description: null, created_at: '2026-01-01' }]),
    );
    render(<Exercises />);
    const item = await screen.findByText('To delete');

    await user.click(within(item.closest('li')!).getByRole('button', { name: 'Delete' }));

    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined } as Response);
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const confirmButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(screen.queryByText('To delete')).not.toBeInTheDocument());
  });
});
