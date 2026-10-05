import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import DurationInput from '../src/DurationInput';

function Wrapper({ initial }: { initial: string }) {
  const [seconds, setSeconds] = useState(initial);
  return (
    <div>
      <DurationInput seconds={seconds} onChange={setSeconds} />
      <output data-testid="seconds-value">{seconds}</output>
    </div>
  );
}

describe('DurationInput', () => {
  it('splits seconds into minutes and seconds fields', () => {
    render(<DurationInput seconds="90" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('min')).toHaveValue(1);
    expect(screen.getByPlaceholderText('sec')).toHaveValue(30);
  });

  it('shows empty fields when seconds is an empty string', () => {
    render(<DurationInput seconds="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('min')).toHaveValue(null);
    expect(screen.getByPlaceholderText('sec')).toHaveValue(null);
  });

  it('combines minutes and seconds input into total seconds', async () => {
    const user = userEvent.setup();
    render(<Wrapper initial="" />);

    await user.type(screen.getByPlaceholderText('min'), '2');
    expect(screen.getByTestId('seconds-value')).toHaveTextContent('120');

    await user.type(screen.getByPlaceholderText('sec'), '5');
    expect(screen.getByTestId('seconds-value')).toHaveTextContent('125');
  });

  it('collapses to zero when both fields are cleared one after another', async () => {
    const user = userEvent.setup();
    render(<Wrapper initial="90" />);

    await user.clear(screen.getByPlaceholderText('min'));
    await user.clear(screen.getByPlaceholderText('sec'));

    expect(screen.getByTestId('seconds-value')).toHaveTextContent('0');
  });

it('treats a cleared minutes field as zero when seconds remain', async () => {
    const user = userEvent.setup();
    render(<Wrapper initial="90" />);

    await user.clear(screen.getByPlaceholderText('min'));

    expect(screen.getByTestId('seconds-value')).toHaveTextContent('30');
  });
});
