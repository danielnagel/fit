import { useCountdown, formatMmSs } from './useTimer';

type Props = {
  seconds: number;
  onComplete?: () => void;
  skipLabel?: string;
  // Instead of pausing the clock (interval set): mark the end of the set, the total time keeps
  // running and the remaining time counts as rest.
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
          <span className="hint">Set completed after {formatMmSs(completedAfterSeconds)}</span>
        ) : (
          <button type="button" className="btn" onClick={onMarkComplete}>
            Completed
          </button>
        )
      ) : (
        <button type="button" className="btn" onClick={running ? pause : start}>
          {running ? 'Pause' : 'Resume'}
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
