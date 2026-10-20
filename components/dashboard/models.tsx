import { formatNumber } from "@/lib/format";
import type { Dashboard } from "@/lib/dashboard";
import { SERIES } from "./colors";
import { HBar } from "./bar";
import { FEW_VOTES, averageScore, fraction, percent, share } from "./numbers";

export function modelStats(models: Dashboard["models"]) {
  const photos = models.reduce((sum, row) => sum + Number(row.photos), 0);
  const rows = models
    .map((row) => {
      const up = Number(row.upvotes);
      const down = Number(row.downvotes);
      return {
        model: row.model,
        photos: Number(row.photos),
        votes: up + down,
        rate: share(up, up + down),
        avg: row.avg_score,
      };
    })
    .sort((a, b) => b.photos - a.photos || a.model.localeCompare(b.model));
  return { rows, photos };
}

type Stats = ReturnType<typeof modelStats>;

export function modelHeadline({ rows, photos }: Stats) {
  if (rows.length === 0) return "No photos yet";
  if (rows.length === 1) return `Every photo so far was captioned by ${rows[0]!.model}`;
  // Only compare models with enough votes: a fallback model that answered
  // once shouldn't win on a single 👍.
  const scored = rows.filter((row) => row.votes >= FEW_VOTES && row.avg !== null);
  if (scored.length >= 2) {
    const best = scored.reduce((a, b) => (b.avg! > a.avg! ? b : a));
    return `${best.model} earns the best scores (avg ${averageScore(best.avg)})`;
  }
  return `${rows[0]!.model} captioned ${percent(share(rows[0]!.photos, photos))} of photos`;
}

// Photos per model, as a share of all photos. The model is whichever Gemini
// model answered, after any fallback (lib/gemini.ts).
export function ModelBoard({ stats }: { stats: Stats }) {
  return (
    <ol className="space-y-4">
      {stats.rows.map((row) => (
        <li key={row.model}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <code className="min-w-0 truncate font-mono text-[13px] font-medium">{row.model}</code>
            <span className="shrink-0 tabular-nums">
              <strong className="font-semibold">{formatNumber(row.photos)}</strong>{" "}
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {row.photos === 1 ? "photo" : "photos"} · {percent(share(row.photos, stats.photos))}
              </span>
            </span>
          </div>
          <div className="mt-1.5">
            <HBar value={fraction(row.photos, stats.photos)} color={SERIES.posts} />
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            avg score {averageScore(row.avg)} per caption
            {row.rate !== null && <> · {percent(row.rate)} 👍 of {formatNumber(row.votes)} votes</>}
          </p>
        </li>
      ))}
    </ol>
  );
}
