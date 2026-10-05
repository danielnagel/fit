import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TrainingMethods from '../src/TrainingMethods';
import type { TrainingMethod } from '../src/trainingMethods';

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => body } as Response;
}

function method(overrides: Partial<TrainingMethod> = {}): TrainingMethod {
  return {
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
    ...overrides,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function createFormContainer() {
  return screen.getByRole('heading', { name: 'New method' }).closest('form')!;
}

describe('TrainingMethods', () => {
  it('loads and displays methods with a human-readable description', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([method()]));

    render(<TrainingMethods />);

    expect(await screen.findByText('Circuit')).toBeInTheDocument();
    expect(screen.getByText('Single exercise · Fixed time window per round · 3 rounds', { exact: false })).toBeInTheDocument();
  });

  it('shows only the fields relevant to the selected timing family and stop condition', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<TrainingMethods />);
    await screen.findByRole('heading', { name: 'New method' });

    const form = createFormContainer();
    const durationLabel = (text: string) => within(form).getByText(text, { exact: false, selector: 'label' });
    const noDurationLabel = (text: string) => within(form).queryByText(text, { exact: false, selector: 'label' });

    // Default: fixed-window-remainder + fixed-count
    expect(durationLabel('Window per round')).toBeInTheDocument();
    expect(within(form).getByLabelText('Rounds')).toBeInTheDocument();
    expect(noDurationLabel('Work per round')).not.toBeInTheDocument();
    expect(within(form).queryByLabelText('Rest formula')).not.toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('Timing'), 'Fixed work/rest per round');
    expect(durationLabel('Work per round')).toBeInTheDocument();
    expect(durationLabel('Rest per round')).toBeInTheDocument();
    expect(noDurationLabel('Window per round')).not.toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('Timing'), 'Self-paced');
    expect(within(form).getByLabelText('Rest formula')).toBeInTheDocument();
    expect(within(form).getByLabelText('Factor (× set duration)')).toBeInTheDocument();
    expect(noDurationLabel('Rest after each set')).not.toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('Rest formula'), 'Fixed rest');
    expect(durationLabel('Rest after each set')).toBeInTheDocument();
    expect(within(form).queryByLabelText('Factor (× set duration)')).not.toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('Stop condition'), 'Time budget (with grace)');
    expect(durationLabel('Time budget')).toBeInTheDocument();
    expect(within(form).queryByLabelText('Rounds')).not.toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('Stop condition'), 'No timer — finish manually');
    expect(within(form).queryByLabelText('Rounds')).not.toBeInTheDocument();
    expect(noDurationLabel('Time budget')).not.toBeInTheDocument();
  });

  it('creates a new method with the default values and reloads the list', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<TrainingMethods />);
    await screen.findByRole('heading', { name: 'New method' });

    const form = createFormContainer();
    await user.type(within(form).getByLabelText('Name'), 'Test');

    fetchMock.mockResolvedValueOnce(jsonResponse(method({ id: 2, name: 'Test' }), true, 201));
    fetchMock.mockResolvedValueOnce(jsonResponse([method({ id: 2, name: 'Test' })]));

    await user.click(within(form).getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Test')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/training-methods',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test',
          scope: 'single',
          timing_family: 'fixed-window-remainder',
          window_seconds: 180,
          work_seconds: 20,
          rest_seconds: 10,
          rest_formula: null,
          rest_factor: 1,
          stop_condition: 'fixed-count',
          rounds: 3,
          total_duration_seconds: 600,
        }),
      }),
    );
  });

  it('shows the server error message when creating fails with a conflict', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<TrainingMethods />);
    await screen.findByRole('heading', { name: 'New method' });

    const form = createFormContainer();
    await user.type(within(form).getByLabelText('Name'), 'Duplicate');

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Method already exists' }, false, 409));

    await user.click(within(form).getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Error: Method already exists')).toBeInTheDocument();
  });

  it('edits a method in place', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([method()]));
    render(<TrainingMethods />);

    const item = await screen.findByText('Circuit');
    const li = item.closest('li')!;

    await user.click(within(li).getByRole('button', { name: 'Edit' }));

    const nameInput = within(li).getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Circuit Pro');

    fetchMock.mockResolvedValueOnce(jsonResponse(method({ name: 'Circuit Pro' }), true, 200));
    fetchMock.mockResolvedValueOnce(jsonResponse([method({ name: 'Circuit Pro' })]));

    await user.click(within(li).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Circuit Pro')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/training-methods/1', expect.objectContaining({ method: 'PUT' }));
  });

  it('deletes a method after confirming the dialog', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([method()]));
    render(<TrainingMethods />);

    const item = await screen.findByText('Circuit');
    const li = item.closest('li')!;
    await user.click(within(li).getByRole('button', { name: 'Delete' }));

    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined } as Response);
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const confirmButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(fetchMock).toHaveBeenCalledWith('/api/training-methods/1', expect.objectContaining({ method: 'DELETE' }));
    await screen.findByText((_, el) => el?.tagName.toLowerCase() === 'h2' && el.textContent === 'Training methods');
    expect(screen.queryByText('Circuit')).not.toBeInTheDocument();
  });

  it('shows an error when deletion fails because the method is still in use', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([method()]));
    render(<TrainingMethods />);

    const item = await screen.findByText('Circuit');
    const li = item.closest('li')!;
    await user.click(within(li).getByRole('button', { name: 'Delete' }));

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Method is still in use' }, false, 409));

    const confirmButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(await screen.findByText('Error: Method is still in use')).toBeInTheDocument();
    expect(screen.getByText('Circuit')).toBeInTheDocument();
  });
});
