import type { ReactNode } from 'react';

type Props = {
  label: ReactNode;
  count: number;
  onIncrement: () => void;
  onDecrement?: () => void;
  // Graut den Zaehler-Button aus (statt Akzentfarbe), z.B. waehrend einer Pausenphase, in der er
  // nicht der primaere Aktionspunkt ist -- dient nur der visuellen Phasenunterscheidung.
  muted?: boolean;
};

export default function TapCounter({ label, count, onIncrement, onDecrement, muted }: Props) {
  return (
    <div className="inline-flex items-center gap-3">
      <span className="text-sm text-fg-muted">{label}</span>
      <button
        type="button"
        className={`${muted ? 'btn' : 'btn-primary'} min-h-14 min-w-20 text-2xl font-bold`}
        onClick={onIncrement}
      >
        {count}
      </button>
      {onDecrement && count > 0 && (
        <button type="button" className="btn" onClick={onDecrement}>
          -1
        </button>
      )}
    </div>
  );
}
