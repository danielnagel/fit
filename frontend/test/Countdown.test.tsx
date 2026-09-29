import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Countdown from '../src/Countdown';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Countdown', () => {
  it('counts down and calls onComplete at zero', () => {
    const onComplete = vi.fn();
    render(<Countdown seconds={2} onComplete={onComplete} />);

    expect(screen.getByText('0:02')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2000));

    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('pause/Weiter toggles the running state', () => {
    render(<Countdown seconds={5} />);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText('0:05')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('0:04')).toBeInTheDocument();
  });

  it('shows a skip button with the given label and jumps to zero', () => {
    const onComplete = vi.fn();
    render(<Countdown seconds={30} onComplete={onComplete} skipLabel="Pause abbrechen" />);

    fireEvent.click(screen.getByRole('button', { name: 'Pause abbrechen' }));

    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('shows a confirm button when onMarkComplete is provided, and switches to the completed hint', () => {
    const onMarkComplete = vi.fn();
    const { rerender } = render(
      <Countdown seconds={60} onMarkComplete={onMarkComplete} completedAfterSeconds={null} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Abgeschlossen' }));
    expect(onMarkComplete).toHaveBeenCalledTimes(1);

    rerender(<Countdown seconds={60} onMarkComplete={onMarkComplete} completedAfterSeconds={12} />);
    expect(screen.getByText('Satz abgeschlossen nach 0:12')).toBeInTheDocument();
  });
});
