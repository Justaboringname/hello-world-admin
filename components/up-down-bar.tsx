import { DOWN, EMPTY, UP } from "@/components/dashboard/colors";
import { formatNumber, formatPercent } from "@/lib/format";

// 👍 against 👎 as one bar that always fills the row. Parts are sized with
// flex-grow so the 2px gap (card color, not a border) never pushes past 100%,
// and a minimum width keeps a single 👎 among hundreds of 👍 visible.
export function UpDownBar({
  up,
  down,
  size = "sm",
  showCounts = false,
}: {
  up: number;
  down: number;
  size?: "sm" | "md";
  // 👍, the share and 👎 in a row under the bar.
  showCounts?: boolean;
}) {
  const total = up + down;
  const height = size === "md" ? "h-4" : "h-2.5";
  const share = formatPercent(up, total);
  const label = total
    ? `${formatNumber(up)} upvotes and ${formatNumber(down)} downvotes, ${share} up`
    : "No votes yet";

  const bar = total ? (
    <div role="img" aria-label={label} className={`flex ${height} w-full gap-[2px]`}>
      {up > 0 && (
        <div
          className={`min-w-[2px] rounded-l-[4px] ${down ? "" : "rounded-r-[4px]"} ${UP}`}
          style={{ flex: `${up} 1 0%` }}
        />
      )}
      {down > 0 && (
        <div
          className={`min-w-[2px] rounded-r-[4px] ${up ? "" : "rounded-l-[4px]"} ${DOWN}`}
          style={{ flex: `${down} 1 0%` }}
        />
      )}
    </div>
  ) : (
    <div role="img" aria-label={label} className={`${height} w-full rounded-[4px] ${EMPTY}`} />
  );

  if (!showCounts) return bar;
  return (
    <div className="min-w-0">
      {bar}
      {/* The bar's label already says all of this to screen readers. */}
      <p aria-hidden className="mt-1 flex items-center justify-between gap-2 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
        <span>👍 {formatNumber(up)}</span>
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{total ? `${share} up` : "No votes"}</span>
        <span>👎 {formatNumber(down)}</span>
      </p>
    </div>
  );
}
