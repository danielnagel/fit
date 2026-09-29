import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CircuitUnitRunner from '../src/CircuitUnitRunner';
import { exerciseFixture, loggedSetFixture, methodFixture, sessionFixture } from './testSupport/sessionFixtures';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function circuitMethod(overrides: Parameters<typeof methodFixture>[0] = {}) {
  return methodFixture({
    scope: 'all',
    timing_family: 'self-paced',
    rest_formula: 'proportional',
    rest_factor: 0.5,
    stop_condition: 'time-budget',
    rounds: null,
    total_duration_seconds: 1200,
    ...overrides,
  });
}

describe('CircuitUnitRunner', () => {
  it('lists every exercise with its target rep range instead of asking for reps', () => {
    render(
      <CircuitUnitRunner
        unit={[exerciseFixture(1, { reps_min: 8, reps_max: 12 }), exerciseFixture(2)]}
        method={circuitMethod()}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    expect(screen.getByText('Übung 1')).toBeInTheDocument();
    expect(screen.getByText(/8-12 Wdh\./)).toBeInTheDocument();
    expect(screen.getByText('Übung 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Wiederholungen')).not.toBeInTheDocument();
    expect(screen.getByText('Gesamtzeit: 0:00')).toBeInTheDocument();
    expect(screen.getByText(/Zeitbudget verbleibend: 20:00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '0' })).toBeInTheDocument();
  });

  it('logs a completed round with the elapsed time for every exercise when the counter is tapped', async () => {
    const logSet = vi.fn().mockResolvedValue(undefined);
    render(
      <CircuitUnitRunner
        unit={[exerciseFixture(1), exerciseFixture(2)]}
        method={circuitMethod()}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={logSet}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    await act(() => vi.advanceTimersByTimeAsync(84_000));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '0' }));
    });

    expect(logSet).toHaveBeenCalledWith(1, undefined, 0, null, 84);
    expect(logSet).toHaveBeenCalledWith(2, undefined, 0, null, 84);
  });

  it('shows a per-round breakdown, not just the last round', () => {
    const session = sessionFixture({
      logged_sets: [
        loggedSetFixture(1, 0, { completed_seconds: 84, reps: null }),
        loggedSetFixture(2, 0, { completed_seconds: 84, reps: null }),
        loggedSetFixture(1, 1, { completed_seconds: 94, reps: null }),
        loggedSetFixture(2, 1, { completed_seconds: 94, reps: null }),
      ],
    });
    render(
      <CircuitUnitRunner
        unit={[exerciseFixture(1), exerciseFixture(2)]}
        method={circuitMethod()}
        session={session}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByText('Runde 1: 1:24')).toBeInTheDocument();
    expect(screen.getByText('Runde 2: 1:34')).toBeInTheDocument();
  });

  it('finishes the unit for every member on its own once the time budget runs out', async () => {
    const finishExercise = vi.fn().mockResolvedValue(undefined);
    render(
      <CircuitUnitRunner
        unit={[exerciseFixture(1), exerciseFixture(2)]}
        method={circuitMethod({ total_duration_seconds: 5 })}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={finishExercise}
        setTimerAnchor={vi.fn()}
      />,
    );

    await act(() => vi.advanceTimersByTimeAsync(5_000));

    expect(finishExercise).toHaveBeenCalledWith(1, undefined);
    expect(finishExercise).toHaveBeenCalledWith(2, undefined);
  });

  it('can also be finished manually before the budget runs out', async () => {
    const finishExercise = vi.fn().mockResolvedValue(undefined);
    render(
      <CircuitUnitRunner
        unit={[exerciseFixture(1)]}
        method={circuitMethod()}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={finishExercise}
        setTimerAnchor={vi.fn()}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Zirkel beenden' }));
    });

    expect(finishExercise).toHaveBeenCalledWith(1, undefined);
  });
});
