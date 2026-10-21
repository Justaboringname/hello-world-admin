import { UpDownBar } from "@/components/up-down-bar";
import { VIBES, isVibe, vibeLabel } from "@/lib/captions";
import type { Dashboard } from "@/lib/dashboard";
import { plural } from "@/lib/format";
import { DOWN, UP } from "./colors";
import { FEW_VOTES, averageScore, percent, share } from "./numbers";
import { Legend, Rank } from "./panel";

// Vibes with enough votes to trust come first, then thin ones, then none.
function tier(votes: number) {
  return votes >= FEW_VOTES ? 2 : votes > 0 ? 1 : 0;
}

// All four voices, even ones nobody has picked yet, ranked by how often their
// captions get a 👍. The rate, not the total, so a popular vibe doesn't win
// just by having more photos; but a 2-for-2 vibe doesn't outrank one with
// hundreds of votes either.
export function rankVibes(vibes: Dashboard["vibes"]) {
  const byKey = new Map(vibes.map((row) => [row.vibe, row]));
  // Old rows might carry a vibe we've since retired; show those after ours.
  const keys = [...new Set([...Object.keys(VIBES), ...vibes.map((row) => row.vibe)])];

  return keys
    .map((vibe) => {
      const row = byKey.get(vibe);
      const up = Number(row?.upvotes ?? 0);
      const down = Number(row?.downvotes ?? 0);
      return {
        vibe,
        known: isVibe(vibe),
        photos: Number(row?.photos ?? 0),
        up,
        down,
        votes: up + down,
        rate: share(up, up + down),
        avg: row?.avg_score ?? null,
      };
    })
    .sort(
      (a, b) =>
        tier(b.votes) - tier(a.votes) ||
        (b.rate ?? -1) - (a.rate ?? -1) ||
        b.votes - a.votes ||
        b.photos - a.photos ||
        Number(b.known) - Number(a.known),
    );
}

export function VibeBoard({ rows }: { rows: ReturnType<typeof rankVibes> }) {
  return (
    <div>
      <ol className="space-y-4">
        {rows.map((row, index) => (
          <li key={row.vibe} className="flex gap-3">
            {row.rate === null ? (
              <span className="w-5 shrink-0 text-right text-xs text-zinc-500 dark:text-zinc-400">–</span>
            ) : (
              <Rank value={index + 1} />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{vibeLabel(row.vibe)}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {row.rate === null ? (
                    <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">No votes yet</span>
                  ) : (
                    <>
                      {percent(row.rate)} <span aria-hidden>👍</span>
                    </>
                  )}
                </span>
              </div>
              <div className="mt-1.5">
                <UpDownBar up={row.up} down={row.down} />
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {plural(row.photos, "photo")} · {plural(row.votes, "vote")}
                {row.avg !== null && <> · avg {averageScore(row.avg)} per caption</>}
                {row.votes > 0 && row.votes < FEW_VOTES && <> · few votes, so take it lightly</>}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4">
        <Legend
          items={[
            { label: "👍 Upvotes", color: UP },
            { label: "👎 Downvotes", color: DOWN },
          ]}
        />
      </div>
    </div>
  );
}
