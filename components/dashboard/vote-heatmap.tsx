import { formatNumber } from "@/lib/format";
import { EMPTY, HEAT, SERIES } from "./colors";
import { DAY_NAMES, fraction, hourName, hourRange, percent, share } from "./numbers";
import { TableView } from "./panel";

type Cell = { dow: number; hour: number; votes: number };

// Monday first: the school week, then the weekend.
const ROW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const HOUR_TICKS: Record<number, string> = { 0: "12a", 6: "6a", 12: "12p", 18: "6p" };
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

// The SQL only sends hours that had votes; every other hour of the week is a
// real zero, so fill them in.
export function summarizeHeatmap(cells: Cell[]) {
  const grid = DAY_NAMES.map(() => HOURS.map(() => 0));
  for (const cell of cells) {
    const dow = Number(cell.dow);
    const hour = Number(cell.hour);
    const votes = Number(cell.votes);
    if (grid[dow]?.[hour] !== undefined && votes > 0) grid[dow]![hour] = votes;
  }

  const dayTotals = grid.map((row) => row.reduce((sum, n) => sum + n, 0));
  const hourTotals = HOURS.map((hour) => grid.reduce((sum, row) => sum + row[hour]!, 0));
  const total = dayTotals.reduce((sum, n) => sum + n, 0);

  let peak: Cell | null = null;
  for (const dow of ROW_ORDER) {
    for (const hour of HOURS) {
      const votes = grid[dow]![hour]!;
      if (votes > 0 && (!peak || votes > peak.votes)) peak = { dow, hour, votes };
    }
  }

  const busiestDay = ROW_ORDER.reduce((best, dow) => (dayTotals[dow]! > dayTotals[best]! ? dow : best));
  const busiestHour = HOURS.reduce((best, hour) => (hourTotals[hour]! > hourTotals[best]! ? hour : best));
  const lateNight = hourTotals.slice(0, 5).reduce((sum, n) => sum + n, 0);

  return { grid, dayTotals, hourTotals, total, peak, busiestDay, busiestHour, lateNight };
}

type Summary = ReturnType<typeof summarizeHeatmap>;

function heatClass(votes: number, max: number) {
  if (votes <= 0) return EMPTY;
  // Linear bins, with any vote at all landing in the first one.
  const bin = Math.min(HEAT.length - 1, Math.ceil(fraction(votes, max) * HEAT.length) - 1);
  return HEAT[Math.max(0, bin)];
}

function tooltipAlign(hour: number) {
  if (hour < 3) return "left-0";
  if (hour > 20) return "right-0";
  return "left-1/2 -translate-x-1/2";
}

// A week of hours as a 7 × 24 grid of squares. Votes are counted by the hour
// they were cast, New York time.
export function VoteHeatmap({ summary }: { summary: Summary }) {
  const { grid, dayTotals, hourTotals, total, peak, busiestDay, busiestHour, lateNight } = summary;
  const max = peak?.votes ?? 0;
  const hourMax = Math.max(0, ...hourTotals);
  const label = peak
    ? `Votes by weekday and hour. Busiest: ${DAY_NAMES[peak.dow]} ${hourRange(peak.hour)} with ${formatNumber(peak.votes)} votes.`
    : "Votes by weekday and hour. No votes yet.";

  return (
    <div>
      <div
        role="img"
        aria-label={label}
        className="grid grid-cols-[2.25rem_repeat(24,minmax(0,1fr))_2.75rem] gap-[2px] text-[11px] text-zinc-500 dark:text-zinc-400"
      >
        <span />
        {HOURS.map((hour) => (
          <span key={hour} className="relative h-4">
            {HOUR_TICKS[hour] && <span className="absolute left-0 top-0">{HOUR_TICKS[hour]}</span>}
          </span>
        ))}
        <span />

        {ROW_ORDER.map((dow) => (
          <Row key={dow} dow={dow} values={grid[dow]!} max={max} peak={peak} share={share(dayTotals[dow]!, total)} />
        ))}

        <span className="self-end pb-px">All</span>
        {HOURS.map((hour) => (
          <span
            key={hour}
            title={`${hourRange(hour)}: ${formatNumber(hourTotals[hour]!)} votes`}
            className="mt-1 flex h-8 items-end border-b border-zinc-300 dark:border-zinc-700"
          >
            {hourTotals[hour]! > 0 && (
              <span
                className={`w-full rounded-t-[2px] ${SERIES.votes}`}
                style={{ height: `max(2px, ${fraction(hourTotals[hour]!, hourMax) * 100}%)` }}
              />
            )}
          </span>
        ))}
        <span />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex flex-wrap items-center gap-1.5" aria-hidden>
          <span className={`h-3 w-3 rounded-[3px] ${EMPTY}`} />
          <span className="mr-2">0</span>
          <span>Fewer</span>
          {HEAT.map((step) => (
            <span key={step} className={`h-3 w-3 rounded-[3px] ${step}`} />
          ))}
          <span>More</span>
          {max > 0 && <span className="ml-1 tabular-nums">(max {formatNumber(max)} an hour)</span>}
        </div>
        {peak && (
          <p className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded-[3px] ring-2 ring-zinc-900 ring-offset-1 ring-offset-surface dark:ring-white" />
            Peak: {DAY_NAMES[peak.dow]} {hourRange(peak.hour)}, {formatNumber(peak.votes)} votes
          </p>
        )}
      </div>

      {total > 0 && (
        <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <Fact label="Busiest day" value={`${DAY_NAMES[busiestDay]}s`} detail={`${percent(share(dayTotals[busiestDay]!, total))} of votes`} />
          <Fact label="Busiest hour" value={hourRange(busiestHour)} detail={`${percent(share(hourTotals[busiestHour]!, total))} of votes`} />
          <Fact label="After midnight" value={percent(share(lateNight, total))} detail="of votes land 12–5 AM" />
        </dl>
      )}

      <TableView
        caption="Votes by weekday (rows) and hour (columns), New York time"
        columns={["Day", ...HOURS.map((hour) => hourName(hour)), "Total"]}
        rows={ROW_ORDER.map((dow) => [DAY_NAMES[dow], ...grid[dow]!, dayTotals[dow]!])}
      />
    </div>
  );
}

function Row({
  dow,
  values,
  max,
  peak,
  share: dayShare,
}: {
  dow: number;
  values: number[];
  max: number;
  peak: Cell | null;
  share: number | null;
}) {
  return (
    <>
      <span className="self-center">{DAY_NAMES[dow].slice(0, 3)}</span>
      {values.map((votes, hour) => {
        const isPeak = peak?.dow === dow && peak.hour === hour;
        return (
          <span
            key={hour}
            className={`group relative h-4 rounded-[3px] sm:h-auto sm:aspect-square ${heatClass(votes, max)} ${
              isPeak
                ? "z-[1] ring-2 ring-zinc-900 ring-offset-1 ring-offset-surface dark:ring-white"
                : "hover:ring-2 hover:ring-zinc-900/40 dark:hover:ring-white/50"
            }`}
          >
            <span
              className={`pointer-events-none absolute bottom-full z-20 mb-2 hidden whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 shadow-lg group-hover:block dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${tooltipAlign(hour)}`}
            >
              <strong className="font-semibold tabular-nums">
                {formatNumber(votes)} {votes === 1 ? "vote" : "votes"}
              </strong>{" "}
              <span className="text-zinc-500 dark:text-zinc-400">
                {DAY_NAMES[dow].slice(0, 3)} {hourRange(hour)}
              </span>
            </span>
          </span>
        );
      })}
      <span className="self-center text-right tabular-nums">{percent(dayShare)}</span>
    </>
  );
}

function Fact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-white/[0.04]">
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold sm:text-base">{value}</dd>
      <dd className="text-xs text-zinc-500 dark:text-zinc-400">{detail}</dd>
    </div>
  );
}
