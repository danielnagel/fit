import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ExerciseInfo from '../src/ExerciseInfo';

describe('ExerciseInfo', () => {
  it('renders nothing without a description', () => {
    const { container } = render(<ExerciseInfo description={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('toggles the description tooltip on click', async () => {
    const user = userEvent.setup();
    render(<ExerciseInfo description="3 s hold" />);

    const button = screen.getByRole('button', { name: 'Show exercise description' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('3 s hold')).toBeInTheDocument();
  });
});
