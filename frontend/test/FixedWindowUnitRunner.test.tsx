import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FixedWindowUnitRunner from '../src/FixedWindowUnitRunner';
import { exerciseFixture, loggedSetFixture, methodFixture, sessionFixture } from './testSupport/sessionFixtures';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function renderRunner(
  overrides: {
    logSet?: ReturnType<typeof vi.fn>;
    setTimerAnchor?: ReturnType<typeof vi.fn>;
    unit?: ReturnType<typeof exerciseFixture>[];
    nextUnit?: ReturnType<typeof exerciseFixture>[] | null;
    method?: ReturnType<typeof methodFixture>;
    session?: ReturnType<typeof sessionFixture>;
  } = {},
) {
  const logSet = overrides.logSet ?? vi.fn();
  const finishExercise = vi.fn();
  const setTimerAnchor = overrides.setTimerAnchor ?? vi.fn();
  const unit = overrides.unit ?? [exerciseFixture(1)];
  const method =
    overrides.method ??
    methodFixture({ timing_family: 'fixed-window-remainder', window_seconds: 90, stop_condition: 'fixed-count', rounds: 3 });
  const session = overrides.session ?? sessionFixture();

  render(
    <FixedWindowUnitRunner
      unit={unit}
      nextUnit={overrides.nextUnit ?? null}
      method={method}
      session={session}
      phaseKeyBase="b0-u0"
      logSet={logSet}
      finishExercise={finishExercise}
      setTimerAnchor={setTimerAnchor}
    />,
  );

  return { logSet, finishExercise, setTimerAnchor };
}

describe('FixedWindowUnitRunner', () => {
  it('shows the exercise, the round label and posts a timer anchor for the window', () => {
    const { setTimerAnchor } = renderRunner();

    expect(screen.getByText('Übung 1')).toBeInTheDocument();
    expect(screen.getByText(/Satz 1\/3/)).toBeInTheDocument();
    expect(screen.getByText('1:30')).toBeInTheDocument();
    expect(setTimerAnchor).toHaveBeenCalledWith('primary', 'b0-u0-0', 90);
  });

  it('logs the entered reps for every unit member on submit', () => {
    const logSet = vi.fn();
    renderRunner({ logSet });

    fireEvent.change(screen.getByLabelText('Wiederholungen'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(logSet).toHaveBeenCalledWith(1, undefined, 0, 9, null);
  });

  it('auto-submits with null reps once the window elapses without input', () => {
    const logSet = vi.fn();
    renderRunner({ logSet });

    act(() => vi.advanceTimersByTime(90_000));

    expect(logSet).toHaveBeenCalledWith(1, undefined, 0, null, null);
  });

  it('marking a set as completed records the elapsed seconds when logging', () => {
    const logSet = vi.fn();
    renderRunner({ logSet });

    act(() => vi.advanceTimersByTime(20_000));
    fireEvent.click(screen.getByRole('button', { name: 'Abgeschlossen' }));

    fireEvent.change(screen.getByLabelText('Wiederholungen'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(logSet).toHaveBeenCalledWith(1, undefined, 0, 8, 20);
  });

  it('does not show a side selector for exercises without an active unilateral flag', () => {
    renderRunner();

    expect(screen.queryByLabelText('Seite')).not.toBeInTheDocument();
  });

  it('shows a side selector defaulting to links and logs the chosen side', () => {
    const logSet = vi.fn();
    renderRunner({ logSet, unit: [exerciseFixture(1, { is_unilateral_active: true })] });

    expect(screen.getByLabelText('Seite')).toHaveValue('left');

    fireEvent.change(screen.getByLabelText('Wiederholungen'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Seite'), { target: { value: 'right' } });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(logSet).toHaveBeenCalledWith(1, undefined, 0, 9, null, 'right');
  });

  it('shows the previous logged set\'s completed duration as a hint', () => {
    const session = sessionFixture({ logged_sets: [loggedSetFixture(1, 0, { completed_seconds: 42 })] });
    render(
      <FixedWindowUnitRunner
        unit={[exerciseFixture(1)]}
        method={methodFixture({ timing_family: 'fixed-window-remainder', window_seconds: 90 })}
        session={session}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    expect(screen.getByText('Letzter Satz nach 0:42 abgeschlossen')).toBeInTheDocument();
  });

  it('previews another round of the same exercise when more rounds remain', () => {
    renderRunner({
      method: methodFixture({ timing_family: 'fixed-window-remainder', window_seconds: 90, stop_condition: 'fixed-count', rounds: 3 }),
    });

    expect(screen.getByText('Nochmal: Übung 1 (Satz 2/3)')).toBeInTheDocument();
  });

  it('previews the next exercise once the last round of the unit is reached', () => {
    renderRunner({
      method: methodFixture({ timing_family: 'fixed-window-remainder', window_seconds: 90, stop_condition: 'fixed-count', rounds: 1 }),
      nextUnit: [exerciseFixture(2)],
    });

    expect(screen.getByText('Nächste Übung: Übung 2')).toBeInTheDocument();
  });

  it('shows there is nothing left in the block on the last round without a next unit', () => {
    renderRunner({
      method: methodFixture({ timing_family: 'fixed-window-remainder', window_seconds: 90, stop_condition: 'fixed-count', rounds: 1 }),
      nextUnit: null,
    });

    expect(screen.getByText('Letzter Satz in diesem Block')).toBeInTheDocument();
  });
});
