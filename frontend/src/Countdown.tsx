import { useCountdown, formatMmSs } from './useTimer';

type Props = {
  seconds: number;
  onComplete?: () => void;
  skipLabel?: string;
  // Statt die Laufzeit zu pausieren (Intervallsatz): Satzende markieren, die Gesamtzeit laeuft
  // weiter und die restliche Zeit gilt als Pause.
  onMarkComplete?: () => void;
  completedAfterSeconds?: number | null;
};

export default function Countdown({ seconds, onComplete, skipLabel, onMarkComplete, completedAfterSeconds }: Props) {
  const { remaining, running, start, pause, skip } = useCountdown(seconds, onComplete);

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <strong className="text-2xl font-semibold tabular-nums tracking-tight text-accent">{formatMmSs(remaining)}</strong>
      {onMarkComplete ? (
        completedAfterSeconds != null ? (
          <span className="hint">Satz abgeschlossen nach {formatMmSs(completedAfterSeconds)}</span>
        ) : (
          <button type="button" className="btn" onClick={onMarkComplete}>
            Abgeschlossen
          </button>
        )
      ) : (
        <button type="button" className="btn" onClick={running ? pause : start}>
          {running ? 'Pause' : 'Weiter'}
        </button>
      )}
      {skipLabel && (
        <button type="button" className="btn" onClick={skip}>
          {skipLabel}
        </button>
      )}
    </span>
  );
}
