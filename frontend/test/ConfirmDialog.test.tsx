import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog, { type ConfirmDialogHandle } from '../src/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    const ref = createRef<ConfirmDialogHandle>();
    render(<ConfirmDialog ref={ref} message="Really delete?" onConfirm={onConfirm} />);

    ref.current?.open();
    expect(screen.getByText('Really delete?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not call onConfirm when cancel is clicked', () => {
    const onConfirm = vi.fn();
    const ref = createRef<ConfirmDialogHandle>();
    render(<ConfirmDialog ref={ref} message="Really delete?" onConfirm={onConfirm} />);

    ref.current?.open();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('supports a custom confirm label', () => {
    const ref = createRef<ConfirmDialogHandle>();
    render(<ConfirmDialog ref={ref} message="End week?" confirmLabel="End" onConfirm={vi.fn()} />);

    ref.current?.open();
    expect(screen.getByRole('button', { name: 'End' })).toBeInTheDocument();
  });
});
