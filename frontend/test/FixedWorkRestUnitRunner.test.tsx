import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FixedWorkRestUnitRunner from '../src/FixedWorkRestUnitRunner';
import { exerciseFixture, loggedSetFixture, methodFixture, sessionFixture } from './testSupport/sessionFixtures';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function baseMethod() {
  return methodFixture({ timing_family: 'fixed-work-rest', work_seconds: 20, rest_seconds: 10, stop_condition: 'fixed-count', rounds: 8 });
}

describe('FixedWorkRestUnitRunner', () => {
  it('starts in the work phase with a zeroed tap counter and posts a timer anchor', () => {
    const setTimerAnchor = vi.fn();
    render(
      <FixedWorkRestUnitRunner
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
    expect(screen.getByText(/Runde 1\/8/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '0' })).toBeInTheDocument();
    expect(screen.getByText('0:20')).toBeInTheDocument();
    expect(setTimerAnchor).toHaveBeenCalledWith('primary', 'b0-u0-work-0', 20);
  });

  it('taps increment the rep counter for the active exercise', () => {
    render(
      <FixedWorkRestUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod()}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '0' }));
    fireEvent.click(screen.getByRole('button', { name: '1' }));

    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
  });

  it('switches to the rest phase once the work window elapses, without logging yet and keeping the tap counter editable', async () => {
    const logSet = vi.fn();
    render(
      <FixedWorkRestUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod()}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={logSet}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '0' }));
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    await act(() => vi.advanceTimersByTimeAsync(20_000));

    expect(logSet).not.toHaveBeenCalled();
    expect(screen.getByText('0:10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
  });

  it('logs the tapped reps and returns to the work phase once the rest window elapses', async () => {
    const logSet = vi.fn();
    render(
      <FixedWorkRestUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod()}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={logSet}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '0' }));
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(logSet).toHaveBeenCalledWith(1, undefined, 0, 2);
    expect(screen.getByText('0:20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '0' })).toBeInTheDocument();
  });

  it('does not show a side selector for exercises without an active unilateral flag', () => {
    render(
      <FixedWorkRestUnitRunner
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

  it('shows a side selector and logs the chosen side once the rest window elapses', async () => {
    const logSet = vi.fn();
    render(
      <FixedWorkRestUnitRunner
        unit={[exerciseFixture(1, { is_unilateral_active: true })]}
        method={baseMethod()}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={logSet}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Seite')).toHaveValue('left');
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    fireEvent.change(screen.getByLabelText('Seite'), { target: { value: 'right' } });
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(logSet).toHaveBeenCalledWith(1, undefined, 0, 1, undefined, 'right');
  });

  it('shows the previous session\'s reps for the current round as a hint', () => {
    const session = sessionFixture({ previous_logged_sets: [{ exercise_id: 1, unit_index: 0, reps: 14 }] });
    render(
      <FixedWorkRestUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod()}
        session={session}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    expect(screen.getByText('Letztes Mal: 14 Wdh.')).toBeInTheDocument();
  });

  it('mutes the rep counter during work and highlights it during rest, with a phase label', async () => {
    render(
      <FixedWorkRestUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod()}
        session={sessionFixture()}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    expect(screen.getByText('Belastung', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '0' })).toHaveClass('btn');
    expect(screen.getByRole('button', { name: '0' })).not.toHaveClass('btn-primary');

    await act(() => vi.advanceTimersByTimeAsync(20_000));

    expect(screen.getByText('Pause', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '0' })).toHaveClass('btn-primary');
  });

  it('shows the reps logged in the previous round of the current session', () => {
    const session = sessionFixture({ logged_sets: [loggedSetFixture(1, 0, { reps: 12 })] });
    render(
      <FixedWorkRestUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod()}
        session={session}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    expect(screen.getByText('Letzte Runde: 12 Wdh.')).toBeInTheDocument();
  });

  it('advances the round based on already logged sets', () => {
    const session = sessionFixture({ logged_sets: [loggedSetFixture(1, 0, { reps: 5 })] });
    render(
      <FixedWorkRestUnitRunner
        unit={[exerciseFixture(1)]}
        method={baseMethod()}
        session={session}
        phaseKeyBase="b0-u0"
        logSet={vi.fn()}
        finishExercise={vi.fn()}
        setTimerAnchor={vi.fn()}
      />,
    );

    expect(screen.getByText(/Runde 2\/8/)).toBeInTheDocument();
  });
});
