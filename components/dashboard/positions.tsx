import type { Dashboard } from "@/lib/dashboard";
import { formatNumber } from "@/lib/format";
import { SERIES } from "./colors";
import { HBar } from "./bar";
import { averageScore, ordinal, percent, share } from "./numbers";

// Which caption slot wins each photo. Gemini writes 3 captions by default
// (admins can add up to 5), so "no bias" means each slot wins about 1 in 3.
export function positionStats(
  positions: Dashboard["positions"],
  decided: number,
  captions: number,
  photos: number,
) {
  const rows = positions
    .map((row) => ({
      position: Number(row.position),
      wins: Number(row.wins),
      captions: Number(row.captions),
      avg: row.avg_score,
      share: share(Number(row.wins), decided),
    }))
    .sort((a, b) => a.position - b.position);

  // The typical number of captions on a photo sets the even split.
  const perPhoto = photos > 0 ? Math.round(captions / photos) : 0;
  const slots = Math.min(5, Math.max(1, perPhoto || rows.length || 3));
  const even = 1 / slots;

  const mostWins = Math.max(0, ...rows.map((row) => row.wins));
  const leaders = rows.filter((row) => row.wins === mostWins && mostWins > 0);
  const leader = leaders.length === 1 ? leaders[0]! : null;

  return { rows, even, slots, leader, decided };
}

type Stats = ReturnType<typeof positionStats>;

// Fewer decided photos than this, and any answer is a coin toss.
const MIN_DECIDED = 5;

// "Does Gemini save its best joke for first?", answered in a sentence.
export function positionHeadline({ rows, even, leader, decided }: Stats) {
  if (!decided || rows.length === 0) return "No photo has a clear winner yet";
  if (decided < MIN_DECIDED) {
    return `Too early to tell: ${decided === 1 ? "1 photo has" : `${decided} photos have`} a clear winner so far`;
  }
  if (!leader) return "No slot wins more often than the others";
  const leaderShare = leader.share ?? 0;
  if (leaderShare - even < 0.05) return "Not really: wins are spread about evenly";
  if (leader.position === 1) return `Yes: the 1st caption wins ${percent(leaderShare)} of photos`;
  return `No: the ${ordinal(leader.position)} caption wins most often (${percent(leaderShare)})`;
}

export function PositionBias({ stats }: { stats: Stats }) {
  const { rows, even } = stats;
  return (
    <div>
      <ol className="space-y-4">
        {rows.map((row) => (
          <li key={row.position}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{ordinal(row.position)} caption</span>
              <span className="tabular-nums">
                <strong className="font-semibold">{percent(row.share)}</strong>{" "}
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatNumber(row.wins)} {row.wins === 1 ? "win" : "wins"}
                </span>
              </span>
            </div>
            <div className="mt-1.5">
              {/* Extra slots only exist on photos an admin added captions to, so
                  the even split doesn't apply to them. */}
              <HBar
                value={row.share ?? 0}
                color={SERIES.votes}
                marker={row.position <= stats.slots ? even : undefined}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {formatNumber(row.captions)} {row.captions === 1 ? "caption" : "captions"} · avg score{" "}
              {averageScore(row.avg)}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-4 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span aria-hidden className="h-3.5 w-px bg-zinc-900/70 dark:bg-white/70" />
        Even split: {percent(even)} each, if position didn&apos;t matter
      </p>
    </div>
  );
}
