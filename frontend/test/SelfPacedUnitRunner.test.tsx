import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SelfPacedUnitRunner from '../src/SelfPacedUnitRunner';
import { exerciseFixture, loggedSetFixture, methodFixture, sessionFixture } from './testSupport/sessionFixtures';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function baseMethod(overrides: Parameters<typeof methodFixture>[0] = {}) {
  return methodFixture({
    timing_family: 'self-paced',
    rest_formula: 'fixed',
    rest_seconds: 15,
    stop_condition: 'all-exercises-done',
    ...overrides,
  });
}

describe('SelfPacedUnitRunner', () => {
  it('starts the stopwatch for the least-logged member and posts timer anchors', () => {
    const setTimerAnchor = vi.fn();
    render(
      <SelfPacedUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod()}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={vi.fn()}
        setTimerAnchor={setTimerAnchor}
      />,
    );

    expect(screen.getByText('Übung 1')).toBeInTheDocument();
    expect(screen.getByText(/Stufe 1/)).toBeInTheDocument();
    expect(screen.getByText('Arbeitszeit: 0:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Satz fertig' })).toBeDisabled();
    expect(setTimerAnchor).toHaveBeenCalledWith('primary', 'b0-u0-work-1-0', 0);
  });

  it('ticks the stopwatch while in the work phase', async () => {
    render(
      <SelfPacedUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod()}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect(screen.getByText('Arbeitszeit: 0:05')).toBeInTheDocument();
  });

  it('logs the set and enters a fixed rest phase on finishing a step', async () => {
    const logSet = vi.fn().mockResolvedValue(undefined);
    render(
      <SelfPacedUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod({ rest_formula: 'fixed', rest_seconds: 15 })}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={logSet}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Wiederholungen'), { target: { value: '12' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Satz fertig' }));
    });

    expect(logSet).toHaveBeenCalledWith(1, undefined, 0, 12);
    expect(screen.getByRole('button', { name: 'Pause abbrechen' })).toBeInTheDocument();
    expect(screen.getByText('0:15')).toBeInTheDocument();
  });

  it('returns to the work phase once the rest countdown elapses', async () => {
    const logSet = vi.fn().mockResolvedValue(undefined);
    render(
      <SelfPacedUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod({ rest_formula: 'fixed', rest_seconds: 15 })}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={logSet}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Wiederholungen'), { target: { value: '12' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Satz fertig' }));
    });
    await act(() => vi.advanceTimersByTimeAsync(15_000));

    expect(screen.getByText('Arbeitszeit: 0:00')).toBeInTheDocument();
  });

  it('does not show a side selector for exercises without an active unilateral flag', () => {
    render(
      <SelfPacedUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod()}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Seite')).not.toBeInTheDocument();
  });

  it('shows a side selector and logs the chosen side on finishing a step', async () => {
    const logSet = vi.fn().mockResolvedValue(undefined);
    render(
      <SelfPacedUnitRunner
        unit={[exerciseFixture(1, { is_unilateral_active: true })]}
        method={baseMethod({ rest_formula: 'fixed', rest_seconds: 15 })}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={logSet}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Seite')).toHaveValue('left');
    fireEvent.change(screen.getByLabelText('Wiederholungen'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Seite'), { target: { value: 'right' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Satz fertig' }));
    });

    expect(logSet).toHaveBeenCalledWith(1, undefined, 0, 12, undefined, 'right');
  });

  it('calls finishExercise for the unit member when finishing the unit', async () => {
    const finishExercise = vi.fn().mockResolvedValue(undefined);
    render(
      <SelfPacedUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod()}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={finishExercise}
        setTimerAnchor={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Übung beenden' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Übung beenden' }));
    });

    expect(finishExercise).toHaveBeenCalledWith(1, undefined);
  });

  it('shows the last logged reps and the previous best-stage record', () => {
    const session = sessionFixture({
      logged_sets: [loggedSetFixture(1, 2, { reps: 9 })],
      records: [{ exercise_id: 1, max_stage: 4, best_reps: 11 }],
    });
    render(
      <SelfPacedUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod()}
        session={session}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    expect(screen.getByText('Letzter Satz: 9 Wiederholungen')).toBeInTheDocument();
    expect(screen.getByText(/Bisherige Bestleistung: Stufe 5, meiste Wiederholungen 11/)).toBeInTheDocument();
  });

  it('previews the next stage after the pause', () => {
    render(
      <SelfPacedUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod()}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    expect(screen.getByText('Nächste Stufe nach der Pause: Stufe 2')).toBeInTheDocument();
  });

  it('shows the remaining time budget for time-budget methods', async () => {
    render(
      <SelfPacedUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod({ stop_condition: 'time-budget', total_duration_seconds: 450 })}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    expect(screen.getByText(/Zeitbudget verbleibend: 7:30/)).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(screen.getByText(/Zeitbudget verbleibend: 7:20/)).toBeInTheDocument();
  });
});
