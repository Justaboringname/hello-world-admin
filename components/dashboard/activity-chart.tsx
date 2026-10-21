"use client";

import { useState, type KeyboardEvent } from "react";
import { formatCompact, formatNumber, plural } from "@/lib/format";
import { SERIES, type SeriesKey } from "./colors";
import { dayLabel, fraction, niceMax } from "./numbers";

export type ActivityDay = {
  day: string;
  votes: number;
  photos: number;
  memes: number;
  signups: number;
};

const PANELS: { key: SeriesKey; label: string; height: string }[] = [
  { key: "votes", label: "Votes", height: "h-28 sm:h-32" },
  { key: "posts", label: "Posts", height: "h-14 sm:h-16" },
  { key: "signups", label: "Sign-ups", height: "h-14 sm:h-16" },
];

// Width of the tick-label gutter on the right. The tooltip and the day
// labels are placed with it, so they line up with the bars.
const GUTTER = "2.25rem";

function valueOf(day: ActivityDay, key: SeriesKey) {
  return key === "posts" ? day.photos + day.memes : day[key];
}

function describe(day: ActivityDay, isToday: boolean) {
  const when = isToday ? "Today so far" : dayLabel(day.day, "long");
  return `${when}: ${formatNumber(day.votes)} votes, ${formatNumber(day.photos + day.memes)} posts, ${formatNumber(day.signups)} sign-ups.`;
}

// Three small charts on one time axis, each with its own scale: votes run in
// the hundreds while sign-ups run in ones, so one shared scale would flatten
// two of them (and a second y-axis would suggest a link that isn't there).
// Pointing at, tapping or arrowing to a day highlights it in all three and
// shows every number for that day in one tooltip.
export function ActivityChart({ days }: { days: ActivityDay[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const last = days.length - 1;

  if (days.length === 0) return null;

  function select(index: number, fromKeyboard = false) {
    const next = Math.max(0, Math.min(last, index));
    setActive(next);
    if (fromKeyboard) setAnnouncement(describe(days[next]!, next === last));
  }

  function onKeyDown(event: KeyboardEvent) {
    const current = active ?? last;
    const moves: Record<string, number> = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    select(moves[event.key]!, true);
  }

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label="Votes, posts and sign-ups per day for the last 30 days. Use the left and right arrow keys to read each day."
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        // Keyboard focus starts on today. A click or tap has already picked a day.
        if (event.currentTarget.matches(":focus-visible")) select(active ?? last, true);
      }}
      onBlur={() => {
        setActive(null);
        setAnnouncement("");
      }}
      // A tap selects a day and leaves it selected; a mouse leaving clears it.
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setActive(null);
      }}
      className="relative rounded-lg"
    >
      {PANELS.map((panel) => (
        <Strip
          key={panel.key}
          series={panel.key}
          label={panel.label}
          height={panel.height}
          days={days}
          active={active}
          onSelect={select}
        />
      ))}

      <div aria-hidden className="mt-1.5 flex text-[11px] text-zinc-500 dark:text-zinc-400" style={{ paddingRight: GUTTER }}>
        <div className="flex h-4 min-w-0 flex-1 gap-[2px]">
          {days.map((day, index) => (
            <div key={day.day} className="relative min-w-0 flex-1">
              {/* Weekly ticks, plus today; a tick too close to today would collide with it. */}
              {((index % 7 === 0 && last - index >= 4) || index === last) && (
                <span
                  className={`absolute top-0 whitespace-nowrap ${
                    index === 0 ? "left-0" : index === last ? "right-0" : "left-1/2 -translate-x-1/2"
                  }`}
                >
                  {index === last ? "Today" : dayLabel(day.day)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {active !== null && (
        <Tooltip day={days[active]!} index={active} count={days.length} isToday={active === last} />
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function Strip({
  series,
  label,
  height,
  days,
  active,
  onSelect,
}: {
  series: SeriesKey;
  label: string;
  height: string;
  days: ActivityDay[];
  active: number | null;
  onSelect: (index: number) => void;
}) {
  const values = days.map((day) => valueOf(day, series));
  const total = values.reduce((sum, value) => sum + value, 0);
  const top = niceMax(Math.max(0, ...values));

  return (
    <div className="mt-4 first:mt-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm" style={{ paddingRight: GUTTER }}>
        <span className="flex items-center gap-1.5 font-medium">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-[3px] ${SERIES[series]}`} />
          {label}
        </span>
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {formatNumber(total)} in 30 days
        </span>
      </div>
      <div className="flex">
        <div
          className={`relative flex min-w-0 flex-1 items-end gap-[2px] border-b border-zinc-300 dark:border-zinc-700 ${height}`}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 border-t border-zinc-100 dark:border-zinc-800"
          />
          {values.map((value, index) => (
            <div
              key={days[index]!.day}
              onPointerEnter={() => onSelect(index)}
              onPointerDown={() => onSelect(index)}
              className={`relative flex h-full min-w-0 flex-1 items-end justify-center rounded-t-[4px] ${
                active === index ? "bg-zinc-900/[0.06] dark:bg-white/[0.08]" : ""
              }`}
            >
              {value > 0 && (
                <div
                  className={`w-full max-w-6 rounded-t-[4px] ${SERIES[series]}`}
                  style={{ height: `max(2px, ${fraction(value, top) * 100}%)` }}
                />
              )}
            </div>
          ))}
          {total === 0 && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-400">
              No {label.toLowerCase()} in the last 30 days
            </p>
          )}
        </div>
        <div
          aria-hidden
          className={`flex shrink-0 flex-col justify-between pl-2 text-[11px] leading-none tabular-nums text-zinc-500 dark:text-zinc-400 ${height}`}
          style={{ width: GUTTER }}
        >
          <span className="-translate-y-1/2">{total > 0 ? formatCompact(top) : ""}</span>
          <span className="translate-y-1/2">0</span>
        </div>
      </div>
    </div>
  );
}

// Matches the tooltip's w-44, so it can be kept inside the chart.
const TOOLTIP_WIDTH = "11rem";

// Beside the highlighted day rather than on top of it, so its bars stay in
// view: to the right in the first half of the month, to the left after. A
// phone has no room beside mid-month days, so it's clamped to the chart's
// edges instead of spilling off the screen.
function Tooltip({
  day,
  index,
  count,
  isToday,
}: {
  day: ActivityDay;
  index: number;
  count: number;
  isToday: boolean;
}) {
  const plot = `(100% - ${GUTTER})`;
  const edge = `calc(100% - ${TOOLTIP_WIDTH})`;
  const style =
    (index + 0.5) / count <= 0.5
      ? { left: `clamp(0px, calc(${plot} * ${(index + 1) / count} + 0.5rem), ${edge})` }
      : { right: `clamp(0px, calc(100% - ${plot} * ${index / count} + 0.5rem), ${edge})` };
  const rows: { key: SeriesKey; value: number; label: string; detail?: string }[] = [
    { key: "votes", value: day.votes, label: day.votes === 1 ? "vote" : "votes" },
    {
      key: "posts",
      value: day.photos + day.memes,
      label: day.photos + day.memes === 1 ? "post" : "posts",
      detail: `${plural(day.photos, "photo")}, ${plural(day.memes, "meme")}`,
    },
    { key: "signups", value: day.signups, label: day.signups === 1 ? "sign-up" : "sign-ups" },
  ];

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-7 z-10 w-44 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      style={style}
    >
      <p className="mb-1 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
        {isToday ? "Today so far" : dayLabel(day.day, "long")}
      </p>
      <ul className="space-y-0.5">
        {rows.map((row) => (
          <li key={row.key}>
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className={`h-0.5 w-3 shrink-0 rounded-full ${SERIES[row.key]}`} />
              <strong className="font-semibold tabular-nums">{formatNumber(row.value)}</strong>
              <span className="text-zinc-500 dark:text-zinc-400">{row.label}</span>
            </span>
            {/* Its own line, indented past the key, so the tooltip stays narrow. */}
            {row.detail && row.value > 0 && (
              <span className="block pl-5 text-zinc-500 dark:text-zinc-400">{row.detail}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
