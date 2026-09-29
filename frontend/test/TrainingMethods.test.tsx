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
  return screen.getByRole('heading', { name: 'Neue Methode' }).closest('form')!;
}

describe('TrainingMethods', () => {
  it('loads and displays methods with a human-readable description', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([method()]));

    render(<TrainingMethods />);

    expect(await screen.findByText('Zirkel')).toBeInTheDocument();
    expect(screen.getByText('Einzelübung · Festes Zeitfenster je Runde · 3 Runden', { exact: false })).toBeInTheDocument();
  });

  it('shows only the fields relevant to the selected timing family and stop condition', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<TrainingMethods />);
    await screen.findByRole('heading', { name: 'Neue Methode' });

    const form = createFormContainer();
    const durationLabel = (text: string) => within(form).getByText(text, { exact: false, selector: 'label' });
    const noDurationLabel = (text: string) => within(form).queryByText(text, { exact: false, selector: 'label' });

    // Default: fixed-window-remainder + fixed-count
    expect(durationLabel('Fensterdauer je Runde')).toBeInTheDocument();
    expect(within(form).getByLabelText('Rundenzahl')).toBeInTheDocument();
    expect(noDurationLabel('Belastung je Runde')).not.toBeInTheDocument();
    expect(within(form).queryByLabelText('Pausenformel')).not.toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('Timing'), 'Feste Belastung/Pause je Runde');
    expect(durationLabel('Belastung je Runde')).toBeInTheDocument();
    expect(durationLabel('Pause je Runde')).toBeInTheDocument();
    expect(noDurationLabel('Fensterdauer je Runde')).not.toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('Timing'), 'Selbstbestimmtes Tempo');
    expect(within(form).getByLabelText('Pausenformel')).toBeInTheDocument();
    expect(within(form).getByLabelText('Faktor (× Satzdauer)')).toBeInTheDocument();
    expect(noDurationLabel('Pause nach jedem Satz')).not.toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('Pausenformel'), 'Feste Pause');
    expect(durationLabel('Pause nach jedem Satz')).toBeInTheDocument();
    expect(within(form).queryByLabelText('Faktor (× Satzdauer)')).not.toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('Stopp-Bedingung'), 'Zeitbudget (mit Kulanz)');
    expect(durationLabel('Zeitbudget')).toBeInTheDocument();
    expect(within(form).queryByLabelText('Rundenzahl')).not.toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('Stopp-Bedingung'), 'Kein Timer — manuell beenden');
    expect(within(form).queryByLabelText('Rundenzahl')).not.toBeInTheDocument();
    expect(noDurationLabel('Zeitbudget')).not.toBeInTheDocument();
  });

  it('creates a new method with the default values and reloads the list', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<TrainingMethods />);
    await screen.findByRole('heading', { name: 'Neue Methode' });

    const form = createFormContainer();
    await user.type(within(form).getByLabelText('Name'), 'Test');

    fetchMock.mockResolvedValueOnce(jsonResponse(method({ id: 2, name: 'Test' }), true, 201));
    fetchMock.mockResolvedValueOnce(jsonResponse([method({ id: 2, name: 'Test' })]));

    await user.click(within(form).getByRole('button', { name: 'Hinzufügen' }));

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
    await screen.findByRole('heading', { name: 'Neue Methode' });

    const form = createFormContainer();
    await user.type(within(form).getByLabelText('Name'), 'Duplikat');

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Methode existiert bereits' }, false, 409));

    await user.click(within(form).getByRole('button', { name: 'Hinzufügen' }));

    expect(await screen.findByText('Fehler: Methode existiert bereits')).toBeInTheDocument();
  });

  it('edits a method in place', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([method()]));
    render(<TrainingMethods />);

    const item = await screen.findByText('Zirkel');
    const li = item.closest('li')!;

    await user.click(within(li).getByRole('button', { name: 'Bearbeiten' }));

    const nameInput = within(li).getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Zirkel Pro');

    fetchMock.mockResolvedValueOnce(jsonResponse(method({ name: 'Zirkel Pro' }), true, 200));
    fetchMock.mockResolvedValueOnce(jsonResponse([method({ name: 'Zirkel Pro' })]));

    await user.click(within(li).getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Zirkel Pro')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/training-methods/1', expect.objectContaining({ method: 'PUT' }));
  });

  it('deletes a method after confirming the dialog', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([method()]));
    render(<TrainingMethods />);

    const item = await screen.findByText('Zirkel');
    const li = item.closest('li')!;
    await user.click(within(li).getByRole('button', { name: 'Löschen' }));

    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined } as Response);
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const confirmButtons = screen.getAllByRole('button', { name: 'Löschen' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(fetchMock).toHaveBeenCalledWith('/api/training-methods/1', expect.objectContaining({ method: 'DELETE' }));
    await screen.findByText((_, el) => el?.tagName.toLowerCase() === 'h2' && el.textContent === 'Trainingsmethoden');
    expect(screen.queryByText('Zirkel')).not.toBeInTheDocument();
  });

  it('shows an error when deletion fails because the method is still in use', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse([method()]));
    render(<TrainingMethods />);

    const item = await screen.findByText('Zirkel');
    const li = item.closest('li')!;
    await user.click(within(li).getByRole('button', { name: 'Löschen' }));

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Methode wird noch verwendet' }, false, 409));

    const confirmButtons = screen.getAllByRole('button', { name: 'Löschen' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(await screen.findByText('Fehler: Methode wird noch verwendet')).toBeInTheDocument();
    expect(screen.getByText('Zirkel')).toBeInTheDocument();
  });
});
