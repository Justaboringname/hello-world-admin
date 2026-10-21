import Link from "next/link";
import { Card, EmptyState, ErrorNote, hrefWith } from "@/components/ui";
import { UpDownBar } from "@/components/up-down-bar";
import { voteHref, type VoteRow } from "@/components/votes/data";
import { KindBadge, VoteTime } from "@/components/votes/votes-table";
import { formatNumber, formatPercent } from "@/lib/format";
import { SeeAllLink } from "./see-all-link";

// How generous a voter is: the share of all their votes that are 👍, with a
// bar so a harsh critic stands out at a glance.
function UpvoteShare({ upvotes, total }: { upvotes: number; total: number }) {
  const downvotes = total - upvotes;
  return (
    <div className="mb-4">
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm tabular-nums">
        <span>
          <span className="text-lg font-semibold">{formatPercent(upvotes, total)}</span>{" "}
          <span className="text-zinc-500 dark:text-zinc-400">of their votes are 👍</span>
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          👍 {formatNumber(upvotes)} · 👎 {formatNumber(downvotes)}
        </span>
      </p>
      <div className="mt-2">
        <UpDownBar up={upvotes} down={downvotes} />
      </div>
    </div>
  );
}

// A user's newest votes on captions and memes.
export function UserVotes({
  userId,
  votes,
  total,
  upvotes,
  error,
}: {
  userId: string;
  votes: VoteRow[];
  total: number;
  // null when the count query failed: the list still shows, the share doesn't.
  upvotes: number | null;
  error: string | null;
}) {
  return (
    <Card
      title="Recent votes"
      description={
        votes.length > 0 && total > votes.length
          ? `Newest ${votes.length} of ${formatNumber(total)}`
          : "Votes on AI captions and memes"
      }
      actions={total > 0 && <SeeAllLink href={hrefWith("/votes", { user: userId })} label="votes by this user" />}
    >
      {error ? (
        <ErrorNote>Couldn&apos;t load their votes: {error}</ErrorNote>
      ) : votes.length === 0 ? (
        <EmptyState>No votes yet.</EmptyState>
      ) : (
        <>
          {upvotes !== null && total > 0 && <UpvoteShare upvotes={upvotes} total={total} />}
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {votes.map((vote) => (
              <li key={`${vote.kind}-${vote.item_id}`} className="flex items-start gap-3 py-2.5">
                <span
                  role="img"
                  aria-label={vote.vote === 1 ? "Upvote" : "Downvote"}
                  className="text-lg leading-6"
                >
                  {vote.vote === 1 ? "👍" : "👎"}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={voteHref(vote)} className="line-clamp-2 text-sm hover:underline">
                    {vote.kind === "caption" ? `“${vote.label}”` : vote.label}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <KindBadge kind={vote.kind} />
                    <VoteTime vote={vote} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
