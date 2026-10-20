import { formatCompact, formatNumber, formatPercent } from "@/lib/format";
import { RatingBar } from "./rating-bar";

// null means that count's query failed; the other tiles still show.
export type VoteSummary = {
  up: number | null;
  down: number | null;
  captions: number | null;
  memes: number | null;
  voters: number | null;
};

function Tile({
  label,
  value,
  hint,
  className = "",
  children,
}: {
  label: string;
  value: number | string | null;
  hint?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col rounded-2xl border border-zinc-200 bg-surface p-4 shadow-sm dark:border-zinc-800 ${className}`}
    >
      <span className="text-xs uppercase tracking-wider text-zinc-500">{label}</span>
      <span
        className="mt-1 text-3xl font-semibold tracking-tight"
        title={typeof value === "number" ? formatNumber(value) : undefined}
      >
        {value === null ? "–" : typeof value === "number" ? formatCompact(value) : value}
      </span>
      {children}
      <span className="mt-auto pt-1 text-xs text-zinc-500">
        {value === null ? "Couldn't count these" : hint}
      </span>
    </div>
  );
}

// Every vote ever cast, on captions and memes together. The same on both
// tabs and unaffected by the filters below, so it's always the big picture.
export function SummaryTiles({ summary }: { summary: VoteSummary }) {
  const { up, down, captions, memes, voters } = summary;
  // Every vote is a 👍 or a 👎, so the two add up to the total.
  const total = up !== null && down !== null ? up + down : null;

  return (
    <section aria-label="Vote totals" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <Tile
        label="Total votes"
        value={total}
        className="col-span-2 sm:col-span-1"
        hint={
          captions !== null && memes !== null ? (
            <>
              📸 {formatNumber(captions)} on captions · 😂 {formatNumber(memes)} on memes
            </>
          ) : (
            "On captions and memes"
          )
        }
      />
      <Tile label="👍 Upvotes" value={up} hint={total ? `${formatPercent(up ?? 0, total)} of votes` : "None yet"} />
      <Tile
        label="👎 Downvotes"
        value={down}
        hint={total ? `${formatPercent(down ?? 0, total)} of votes` : "None yet"}
      />
      <Tile label="Upvote share" value={total === null ? null : formatPercent(up ?? 0, total)} hint="👍 out of all votes">
        {total !== null && (
          <div className="mt-2">
            <RatingBar up={up ?? 0} down={down ?? 0} showCounts={false} />
          </div>
        )}
      </Tile>
      <Tile
        label="Unique voters"
        value={voters}
        hint={
          voters && total !== null
            ? `${formatNumber(Math.round((total / voters) * 10) / 10)} votes each on average`
            : "People who voted at least once"
        }
      />
    </section>
  );
}
