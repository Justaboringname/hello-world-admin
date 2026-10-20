import { formatNumber, formatPercent } from "@/lib/format";

// The dashboard's 👍/👎 colors (components/dashboard/colors.ts): opposite
// hues, checked for color-blind separation in both themes.
const UP = "bg-[#2a78d6] dark:bg-[#3987e5]";
const DOWN = "bg-[#e34948] dark:bg-[#e66767]";

// 👍 against 👎 as one bar that always fills the row. The parts are sized
// with flex-grow so the 2px gap never pushes past 100%, and a minimum width
// keeps a lone 👎 among hundreds of 👍 visible.
export function RatingBar({
  up,
  down,
  showCounts = true,
}: {
  up: number;
  down: number;
  showCounts?: boolean;
}) {
  const total = up + down;
  const share = formatPercent(up, total);
  const label = total
    ? `${formatNumber(up)} upvotes and ${formatNumber(down)} downvotes, ${share} up`
    : "No votes yet";

  return (
    <div className="min-w-0">
      <div role="img" aria-label={label} className="flex h-2.5 w-full gap-[2px]">
        {total === 0 && <div className="w-full rounded-[4px] bg-zinc-100 dark:bg-zinc-800" />}
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
      {/* The bar's label already says all of this to screen readers. */}
      {showCounts && (
        <p aria-hidden className="mt-1 flex items-center justify-between gap-2 text-xs tabular-nums text-zinc-500">
          <span>👍 {formatNumber(up)}</span>
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {total ? `${share} up` : "No votes"}
          </span>
          <span>👎 {formatNumber(down)}</span>
        </p>
      )}
    </div>
  );
}
