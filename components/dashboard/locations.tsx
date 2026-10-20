import { formatNumber } from "@/lib/format";
import type { Dashboard } from "@/lib/dashboard";
import { SERIES } from "./colors";
import { HBar } from "./bar";
import { fraction, percent, share } from "./numbers";
import { Rank } from "./panel";

// The top spots, as people typed them. The SQL ignores case and outer spaces,
// so "butler library" and "Butler Library " count together. Bars are scaled
// to the busiest spot; the percentage is of all photos.
export function LocationBoard({
  locations,
  photos,
}: {
  locations: Dashboard["locations"];
  photos: number;
}) {
  const max = Math.max(0, ...locations.map((row) => Number(row.photos)));
  return (
    <ol className="space-y-3">
      {locations.map((row, index) => (
        <li key={row.location} className="flex gap-3">
          <Rank value={index + 1} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{row.location}</span>
              <span className="shrink-0 tabular-nums">
                <strong className="font-semibold">{formatNumber(row.photos)}</strong>{" "}
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {percent(share(row.photos, photos))}
                </span>
              </span>
            </div>
            <div className="mt-1">
              <HBar value={fraction(row.photos, max)} color={SERIES.posts} height="h-2.5" />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
