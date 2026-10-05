import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProgressChart from '../src/ProgressChart';
import type { ProgressPoint } from '../src/ProgressChart';

describe('ProgressChart', () => {
  it('shows a hint instead of a chart when there are no usable points', () => {
    render(<ProgressChart points={[]} />);
    expect(
      screen.getByText('No completed sets with reps for this exercise yet.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows the hint when all points have a null max_reps', () => {
    const points: ProgressPoint[] = [
      { training_session_id: 1, performed_at: '2026-01-01', max_reps: null, total_reps: null, set_count: 0 },
    ];
    render(<ProgressChart points={points} />);
    expect(
      screen.getByText('No completed sets with reps for this exercise yet.'),
    ).toBeInTheDocument();
  });

  it('renders an svg chart with a point per usable entry', () => {
    const points: ProgressPoint[] = [
      { training_session_id: 1, performed_at: '2026-01-01', max_reps: 8, total_reps: 24, set_count: 3 },
      { training_session_id: 2, performed_at: '2026-01-05', max_reps: 10, total_reps: 30, set_count: 3 },
      { training_session_id: 3, performed_at: '2026-01-10', max_reps: null, total_reps: null, set_count: 0 },
    ];
    render(<ProgressChart points={points} />);

    const svg = screen.getByRole('img', { name: 'Progress (best rep count per training)' });
    expect(svg).toBeInTheDocument();
    expect(svg.querySelectorAll('circle')).toHaveLength(2);
  });

  it('renders a single point without dividing by zero', () => {
    const points: ProgressPoint[] = [
      { training_session_id: 1, performed_at: '2026-01-01', max_reps: 5, total_reps: 5, set_count: 1 },
    ];
    render(<ProgressChart points={points} />);

    const svg = screen.getByRole('img', { name: 'Progress (best rep count per training)' });
    expect(svg.querySelectorAll('circle')).toHaveLength(1);
  });
});
