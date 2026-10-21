import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { timeAgo } from "@/lib/time";
import { voteHref, voterName, wasChanged, type VoteRow } from "./data";

export function KindBadge({ kind }: { kind: VoteRow["kind"] }) {
  return kind === "caption" ? <Badge tone="violet">📸 Caption</Badge> : <Badge tone="amber">😂 Meme</Badge>;
}

export function VoteIcon({ vote }: { vote: VoteRow["vote"] }) {
  return (
    <span role="img" aria-label={vote === 1 ? "Upvote" : "Downvote"} className="text-lg leading-none">
      {vote === 1 ? "👍" : "👎"}
    </span>
  );
}

export function VoteTime({ vote }: { vote: Pick<VoteRow, "created_at" | "updated_at"> }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <time dateTime={vote.created_at} title={formatDateTime(vote.created_at)}>
        {timeAgo(vote.created_at)}
      </time>
      {wasChanged(vote) && (
        <span title={`Changed ${formatDateTime(vote.updated_at)}`}>
          <Badge tone="blue">changed</Badge>
        </span>
      )}
    </span>
  );
}

const headClass = "px-4 py-3 font-medium";

// One row per vote, newest first. Wide, so it scrolls sideways on phones
// rather than squashing the labels.
export function VotesTable({ votes }: { votes: VoteRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-surface shadow-sm dark:border-zinc-800">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">Votes, newest first</caption>
        <thead className="border-b border-zinc-200 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 dark:border-zinc-800">
          <tr>
            <th scope="col" className={headClass}>
              Voter
            </th>
            <th scope="col" className={headClass}>
              Vote
            </th>
            <th scope="col" className={headClass}>
              On
            </th>
            <th scope="col" className={headClass}>
              What
            </th>
            <th scope="col" className={headClass}>
              When
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {votes.map((vote) => {
            const name = voterName(vote);
            return (
              <tr key={`${vote.kind}-${vote.item_id}-${vote.user_id}`} className="align-middle">
                <td className="px-4 py-2.5">
                  <Link href={`/users/${vote.user_id}`} className="group flex items-center gap-2.5">
                    <Avatar src={vote.voter_avatar_url} name={name} />
                    <span
                      className={`max-w-[12rem] truncate group-hover:underline ${vote.voter_name ? "font-medium" : "italic text-zinc-500 dark:text-zinc-400"}`}
                    >
                      {name}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <VoteIcon vote={vote.vote} />
                </td>
                <td className="px-4 py-2.5">
                  <KindBadge kind={vote.kind} />
                </td>
                <td className="px-4 py-2.5">
                  <Link
                    href={voteHref(vote)}
                    title={vote.label}
                    className="block max-w-[26rem] truncate hover:underline"
                  >
                    {vote.kind === "caption" ? `“${vote.label}”` : vote.label}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-zinc-500 dark:text-zinc-400">
                  <VoteTime vote={vote} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
