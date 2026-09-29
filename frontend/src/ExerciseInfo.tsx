import { useState } from 'react';

type Props = {
  description: string | null;
};

export default function ExerciseInfo({ description }: Props) {
  const [open, setOpen] = useState(false);

  if (!description) return null;

  return (
    <span className="group relative ml-1.5 inline-flex align-middle">
      <button
        type="button"
        className="flex size-5 items-center justify-center rounded-full border border-edge bg-surface-3 text-xs font-semibold italic text-fg-muted transition-colors hover:border-accent hover:text-accent"
        aria-label="Übungsbeschreibung anzeigen"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        i
      </button>
      <span
        className={`absolute bottom-full left-0 z-20 mb-2 w-max max-w-64 rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm font-normal normal-case text-fg shadow-lg shadow-black/40 ${
          open ? 'block' : 'hidden group-hover:block'
        }`}
      >
        {description}
      </span>
    </span>
  );
}
