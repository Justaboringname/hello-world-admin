import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Card, EmptyState, LoadError, hrefWith, linkClass } from "@/components/ui";
import type { VoteRow } from "@/components/votes/data";
import { VoteIcon, VoteTime } from "@/components/votes/votes-table";
import { displayName, formatNumber } from "@/lib/format";

// The newest votes on one meme, and who cast them. "See all" opens /votes
// searched by the title: the closest the shared URL contract gets to "this
// meme only" (another meme whose title contains this one shows up too).
export function RecentVotes({
  title,
  votes,
  total,
  error,
}: {
  title: string;
  votes: VoteRow[];
  total: number;
  error: { code?: string; message: string } | null;
}) {
  return (
    <Card
      title="Recent votes"
      description={
        !error && total > votes.length
          ? `Newest ${votes.length} of ${formatNumber(total)}`
          : "Who voted, and how"
      }
      actions={
        total > 0 && (
          <Link
            href={hrefWith("/votes", { kind: "meme", q: title })}
            className={`whitespace-nowrap text-sm ${linkClass}`}
          >
            See all →
          </Link>
        )
      }
    >
      {error ? (
        <LoadError what="its votes" error={error} />
      ) : votes.length === 0 ? (
        <EmptyState>No votes yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {votes.map((vote) => {
            const name = displayName(vote.voter_name);
            return (
              <li key={vote.user_id} className="flex items-center gap-3 py-2.5">
                <Link href={`/users/${vote.user_id}`} className="group flex min-w-0 flex-1 items-center gap-2.5">
                  <Avatar src={vote.voter_avatar_url} name={name} decorative />
                  <span
                    className={`truncate text-sm group-hover:underline ${vote.voter_name ? "font-medium" : "italic text-zinc-500 dark:text-zinc-400"}`}
                  >
                    {name}
                  </span>
                </Link>
                <VoteIcon vote={vote.vote} />
                <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  <VoteTime vote={vote} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
