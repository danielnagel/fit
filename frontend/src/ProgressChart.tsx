export type ProgressPoint = {
  training_session_id: number;
  performed_at: string;
  max_reps: number | null;
  total_reps: number | null;
  set_count: number;
};

type Props = {
  points: ProgressPoint[];
};

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = 32;

export default function ProgressChart({ points }: Props) {
  const usable = points.filter((p) => p.max_reps !== null);
  if (usable.length === 0) {
    return <p className="hint mt-3">Noch keine abgeschlossenen Sätze mit Wiederholungen für diese Übung.</p>;
  }

  const maxReps = Math.max(...usable.map((p) => p.max_reps!));
  const dates = usable.map((p) => new Date(p.performed_at).getTime());
  const minTime = Math.min(...dates);
  const maxTime = Math.max(...dates);
  const timeSpan = maxTime - minTime || 1;

  const toX = (t: number) => PADDING + ((t - minTime) / timeSpan) * (WIDTH - 2 * PADDING);
  const toY = (reps: number) => HEIGHT - PADDING - (reps / (maxReps || 1)) * (HEIGHT - 2 * PADDING);

  const coords = usable.map((p) => ({
    x: toX(new Date(p.performed_at).getTime()),
    y: toY(p.max_reps!),
    point: p,
  }));

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="img"
      aria-label="Fortschritt (beste Wiederholungszahl je Training)"
      className="mt-3 rounded-xl border border-edge bg-surface-2 p-2"
    >
      <line x1={PADDING} y1={HEIGHT - PADDING} x2={WIDTH - PADDING} y2={HEIGHT - PADDING} className="stroke-edge" />
      <path d={path} fill="none" strokeWidth={2} className="stroke-accent" />
      {coords.map((c) => (
        <circle key={c.point.training_session_id} cx={c.x} cy={c.y} r={4} className="fill-accent">
          <title>
            {new Date(c.point.performed_at).toLocaleDateString('de-DE')}: {c.point.max_reps} Wdh. (beste Serie)
          </title>
        </circle>
      ))}
    </svg>
  );
}
