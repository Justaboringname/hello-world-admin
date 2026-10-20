// A horizontal bar from a hairline baseline, for ranked lists. Square at the
// baseline, rounded at the end that carries the value. `value` and `marker`
// are 0–1; the marker is a reference line (say, an even split).
export function HBar({
  value,
  color,
  marker,
  height = "h-3",
}: {
  value: number;
  color: string;
  marker?: number;
  height?: string;
}) {
  return (
    <div className={`relative border-l border-zinc-300 dark:border-zinc-700 ${height}`}>
      {value > 0 && (
        <div
          className={`h-full min-w-[2px] rounded-r-[4px] ${color}`}
          style={{ width: `${Math.min(1, value) * 100}%` }}
        />
      )}
      {marker !== undefined && (
        <div
          aria-hidden
          className="absolute -inset-y-1 w-px bg-zinc-900/70 dark:bg-white/70"
          style={{ left: `${Math.min(1, Math.max(0, marker)) * 100}%` }}
        />
      )}
    </div>
  );
}
