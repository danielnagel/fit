type Props = {
  seconds: string;
  onChange: (seconds: string) => void;
};

export default function DurationInput({ seconds, onChange }: Props) {
  const total = seconds === '' ? null : Number(seconds);
  const minutes = total === null ? '' : String(Math.floor(total / 60));
  const secs = total === null ? '' : String(total % 60);

  const update = (newMinutes: string, newSeconds: string) => {
    if (newMinutes === '' && newSeconds === '') {
      onChange('');
      return;
    }
    const m = newMinutes === '' ? 0 : Number(newMinutes);
    const s = newSeconds === '' ? 0 : Number(newSeconds);
    onChange(String(m * 60 + s));
  };

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        placeholder="min"
        value={minutes}
        onChange={(e) => update(e.target.value, secs)}
        className="field w-16"
      />
      <span className="text-fg-muted">:</span>
      <input
        type="number"
        min={0}
        max={59}
        placeholder="sek"
        value={secs}
        onChange={(e) => update(minutes, e.target.value)}
        className="field w-16"
      />
    </span>
  );
}
