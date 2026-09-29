import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BlockRunner from '../src/BlockRunner';
import { blockFixture, exerciseFixture, loggedSetFixture, methodFixture, sessionFixture } from './testSupport/sessionFixtures';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const noop = vi.fn();

describe('BlockRunner', () => {
  it('dispatches fixed-window-remainder blocks to the window-based UI', () => {
    const block = blockFixture({ training_method: methodFixture({ timing_family: 'fixed-window-remainder' }) });
    render(
      <BlockRunner
        session={sessionFixture()}
        block={block}
        phaseKeyBase="b0"
        logSet={noop}
        finishExercise={noop}
        setTimerAnchor={noop}
      />,
    );

    expect(screen.getByRole('button', { name: 'Weiter' })).toBeInTheDocument();
  });

  it('dispatches fixed-work-rest blocks to the tap-counter UI', () => {
    const block = blockFixture({
      training_method: methodFixture({ timing_family: 'fixed-work-rest', work_seconds: 20, rest_seconds: 10 }),
    });
    render(
      <BlockRunner
        session={sessionFixture()}
        block={block}
        phaseKeyBase="b0"
        logSet={noop}
        finishExercise={noop}
        setTimerAnchor={noop}
      />,
    );

    expect(screen.getByRole('button', { name: '0' })).toBeInTheDocument();
  });

  it('dispatches self-paced blocks to the stopwatch UI', () => {
    const block = blockFixture({
      training_method: methodFixture({
        timing_family: 'self-paced',
        rest_formula: 'fixed',
        rest_seconds: 15,
        stop_condition: 'all-exercises-done',
      }),
    });
    render(
      <BlockRunner
        session={sessionFixture()}
        block={block}
        phaseKeyBase="b0"
        logSet={noop}
        finishExercise={noop}
        setTimerAnchor={noop}
      />,
    );

    expect(screen.getByRole('button', { name: 'Übung beenden' })).toBeInTheDocument();
  });

  it('dispatches self-paced blocks with more than one exercise to the circuit UI', () => {
    const block = blockFixture({
      training_method: methodFixture({ scope: 'all', timing_family: 'self-paced', stop_condition: 'time-budget' }),
      exercises: [exerciseFixture(1), exerciseFixture(2)],
    });
    render(
      <BlockRunner
        session={sessionFixture()}
        block={block}
        phaseKeyBase="b0"
        logSet={noop}
        finishExercise={noop}
        setTimerAnchor={noop}
      />,
    );

    expect(screen.getByRole('button', { name: 'Zirkel beenden' })).toBeInTheDocument();
  });

  it('renders nothing once every unit in the block is done', () => {
    const block = blockFixture({
      training_method: methodFixture({ stop_condition: 'fixed-count', rounds: 1 }),
      exercises: [exerciseFixture(1)],
    });
    const session = sessionFixture({ logged_sets: [loggedSetFixture(1, 0)] });

    const { container } = render(
      <BlockRunner
        session={session}
        block={block}
        phaseKeyBase="b0"
        logSet={noop}
        finishExercise={noop}
        setTimerAnchor={noop}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('skips already-finished units and runs the next one', () => {
    const block = blockFixture({
      training_method: methodFixture({ scope: 'single', stop_condition: 'fixed-count', rounds: 1 }),
      exercises: [exerciseFixture(1), exerciseFixture(2)],
    });
    const session = sessionFixture({ logged_sets: [loggedSetFixture(1, 0)] });

    render(
      <BlockRunner
        session={session}
        block={block}
        phaseKeyBase="b0"
        logSet={noop}
        finishExercise={noop}
        setTimerAnchor={noop}
      />,
    );

    expect(screen.getByText('Übung 2')).toBeInTheDocument();
  });
});
