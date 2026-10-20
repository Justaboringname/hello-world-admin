import { formatCompact, formatNumber } from "@/lib/format";
import { BAD_TEXT, CONTEXT, GOOD_TEXT } from "./colors";
import { dayLabel, fraction, weekChange } from "./numbers";

const TONES = { good: GOOD_TEXT, bad: BAD_TEXT, flat: "text-zinc-500 dark:text-zinc-400" };
const SPOKEN = { good: "Up", bad: "Down", flat: "" };

// A headline number with how it moved: this week against the 7 days before.
// Big numbers keep proportional digits; tabular-nums is for columns.
export function StatTile({
  icon,
  label,
  value,
  current,
  previous,
  comparison,
  trend,
  meter,
  facts,
}: {
  icon: string;
  label: string;
  value: number;
  current: number;
  previous: number;
  comparison: React.ReactNode;
  trend?: { days: { day: string; value: number }[]; color: string; noun: string };
  meter?: { value: number; max: number; fill: string; track: string; label: React.ReactNode };
  facts: React.ReactNode;
}) {
  const change = weekChange(current, previous);

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-zinc-200 bg-surface p-5 shadow-sm dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            <span aria-hidden>{icon}</span> {label}
          </h2>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{formatCompact(value)}</p>
        </div>
        {trend && <Sparkline {...trend} />}
      </div>

      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
        <span className={`font-semibold ${TONES[change.tone]}`}>
          <span aria-hidden>{change.arrow}</span>
          <span className="sr-only">{SPOKEN[change.tone]}</span> {change.text}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">{comparison}</span>
      </p>

      {meter && (
        <div className="mt-3">
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={meter.max}
            aria-valuenow={meter.value}
            aria-label={label}
            className={`h-2 w-full overflow-hidden rounded-full ${meter.track}`}
          >
            <div
              className={`h-full rounded-full ${meter.fill}`}
              style={{ width: `${fraction(meter.value, meter.max) * 100}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{meter.label}</p>
        </div>
      )}

      <div className="mt-auto pt-3">
        <p className="border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {facts}
        </p>
      </div>
    </section>
  );
}

// 14 tiny columns, one per day: the last 7 in the tile's color, the 7 before
// in grey, so the week-over-week change is visible at a glance.
function Sparkline({
  days,
  color,
  noun,
}: {
  days: { day: string; value: number }[];
  color: string;
  noun: string;
}) {
  const max = Math.max(0, ...days.map((d) => d.value));
  return (
    <div
      aria-hidden
      className="flex h-10 w-28 shrink-0 items-end gap-[2px] border-b border-zinc-200 dark:border-zinc-700"
    >
      {days.map((d, index) => (
        <div
          key={d.day}
          title={`${dayLabel(d.day, "long")}: ${formatNumber(d.value)} ${noun}`}
          className="flex h-full flex-1 items-end"
        >
          {d.value > 0 && (
            <div
              className={`w-full rounded-t-[2px] ${index >= days.length - 7 ? color : CONTEXT}`}
              style={{ height: `max(2px, ${fraction(d.value, max) * 100}%)` }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
