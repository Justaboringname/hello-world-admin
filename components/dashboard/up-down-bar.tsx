import { formatNumber } from "@/lib/format";
import { DOWN, EMPTY, UP } from "./colors";
import { percent, share } from "./numbers";

// 👍 against 👎 as one bar that always fills the row. Parts are sized with
// flex-grow so the 2px gap (card color, not a border) never pushes past 100%,
// and a minimum width keeps a single 👎 among hundreds of 👍 visible.
export function UpDownBar({
  up,
  down,
  size = "sm",
}: {
  up: number;
  down: number;
  size?: "sm" | "md";
}) {
  const total = up + down;
  const height = size === "md" ? "h-4" : "h-2.5";
  const label = total
    ? `${formatNumber(up)} 👍 and ${formatNumber(down)} 👎, ${percent(share(up, total))} up`
    : "No votes yet";

  if (!total) {
    return <div role="img" aria-label={label} className={`${height} w-full rounded-[4px] ${EMPTY}`} />;
  }

  return (
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
  );
}
