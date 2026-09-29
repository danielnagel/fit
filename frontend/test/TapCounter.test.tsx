import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TapCounter from '../src/TapCounter';

describe('TapCounter', () => {
  it('shows the label and current count, and increments on tap', async () => {
    const user = userEvent.setup();
    const onIncrement = vi.fn();
    render(<TapCounter label="Wiederholungen" count={3} onIncrement={onIncrement} />);

    expect(screen.getByText('Wiederholungen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '3' }));

    expect(onIncrement).toHaveBeenCalledTimes(1);
  });

  it('only shows the decrement button when onDecrement is given and count > 0', () => {
    const { rerender } = render(<TapCounter label="Wdh" count={0} onIncrement={vi.fn()} onDecrement={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '-1' })).not.toBeInTheDocument();

    rerender(<TapCounter label="Wdh" count={2} onIncrement={vi.fn()} onDecrement={vi.fn()} />);
    expect(screen.getByRole('button', { name: '-1' })).toBeInTheDocument();

    rerender(<TapCounter label="Wdh" count={2} onIncrement={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '-1' })).not.toBeInTheDocument();
  });

  it('calls onDecrement when the -1 button is clicked', async () => {
    const user = userEvent.setup();
    const onDecrement = vi.fn();
    render(<TapCounter label="Wdh" count={2} onIncrement={vi.fn()} onDecrement={onDecrement} />);

    await user.click(screen.getByRole('button', { name: '-1' }));
    expect(onDecrement).toHaveBeenCalledTimes(1);
  });
});
