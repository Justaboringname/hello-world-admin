import { UpDownBar } from "@/components/up-down-bar";
import type { Dashboard } from "@/lib/dashboard";
import { formatNumber, plural } from "@/lib/format";
import { DOWN, UP } from "./colors";
import { FEW_VOTES, decimal, percent, share } from "./numbers";
import { Legend } from "./panel";

type Kind = Dashboard["kinds"]["photo"];

function sideStats(kind: Kind) {
  const votes = kind.upvotes + kind.downvotes;
  return {
    ...kind,
    votes,
    rate: share(kind.upvotes, votes),
    perPost: share(votes, kind.posts),
    voted: share(kind.voted_posts, kind.posts),
  };
}

// Who gets the bigger share of 👍: Gemini's captions or memes people made.
// The upvote rate ignores how many posts each side has, so it's fair even
// when one side has far more posts.
export function compareKinds(kinds: Dashboard["kinds"]) {
  const ai = sideStats(kinds.photo);
  const humans = sideStats(kinds.meme);
  let winner: "ai" | "humans" | "tie" | null = null;
  if (ai.rate !== null && humans.rate !== null && ai.votes >= FEW_VOTES && humans.votes >= FEW_VOTES) {
    const gap = ai.rate - humans.rate;
    winner = Math.abs(gap) < 0.02 ? "tie" : gap > 0 ? "ai" : "humans";
  }
  return { ai, humans, winner };
}

type Comparison = ReturnType<typeof compareKinds>;

export function AiVsHumans({
  comparison,
  captions,
  classics,
}: {
  comparison: Comparison;
  captions: number;
  classics: number;
}) {
  const { ai, humans, winner } = comparison;
  const perCaption = share(ai.votes, captions);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Side
          icon="✨"
          name="AI captions"
          posts={plural(ai.posts, "photo")}
          stats={ai}
          isWinner={winner === "ai"}
        />
        <Side
          icon="😂"
          name="Memes"
          posts={plural(humans.posts, "meme")}
          stats={humans}
          isWinner={winner === "humans"}
        />
      </div>
      <div className="mt-3">
        <Legend
          items={[
            { label: "👍 Upvotes", color: UP },
            { label: "👎 Downvotes", color: DOWN },
          ]}
        />
      </div>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        A photo&apos;s votes are spread over its captions
        {perCaption !== null && <>, so that&apos;s {decimal(perCaption)} per caption</>}.
        {classics > 0 && (
          <>
            {" "}
            Memes are the ones people made; the {formatNumber(classics)} seeded{" "}
            {classics === 1 ? "classic isn't" : "classics aren't"} counted.
          </>
        )}
      </p>
    </div>
  );
}

function Side({
  icon,
  name,
  posts,
  stats,
  isWinner,
}: {
  icon: string;
  name: string;
  posts: string;
  stats: ReturnType<typeof sideStats>;
  isWinner: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl p-3 ${
        isWinner
          ? "bg-zinc-50 ring-1 ring-zinc-400 dark:bg-white/[0.04] dark:ring-zinc-500"
          : "bg-zinc-50 dark:bg-white/[0.04]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        <p className="text-sm font-medium">
          <span aria-hidden>{icon}</span> {name}
        </p>
        {isWinner && (
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white dark:bg-white dark:text-zinc-900">
            🏆 Funnier
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{posts}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{percent(stats.rate)}</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">of votes are 👍</p>
      <div className="mt-2">
        <UpDownBar up={stats.upvotes} down={stats.downvotes} size="md" />
      </div>
      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500 dark:text-zinc-400">Votes</dt>
          <dd className="font-medium tabular-nums">{formatNumber(stats.votes)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500 dark:text-zinc-400">Per post</dt>
          <dd className="font-medium tabular-nums">
            {stats.perPost === null ? "–" : decimal(stats.perPost)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500 dark:text-zinc-400">Voted on</dt>
          <dd className="font-medium tabular-nums">{percent(stats.voted)}</dd>
        </div>
      </dl>
    </div>
  );
}
