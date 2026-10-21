import Link from "next/link";
import { Badge } from "@/components/ui";
import { VoteTally } from "@/components/vote-tally";
import { formatDateTime, scoreTone, signedScore } from "@/lib/format";
import { memeImageUrl } from "@/lib/storage";
import { timeAgo } from "@/lib/time";
import { memeAlt, memeAuthor, type MemeRow } from "./data";
import { MemeImage } from "./meme-image";
import { MembersOnlyBadge } from "./members-only-badge";

// One meme in the /memes grid. The whole card opens its admin page.
export function MemeCard({ meme }: { meme: MemeRow }) {
  return (
    <Link
      href={`/memes/${meme.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-surface shadow-sm transition hover:shadow-md dark:border-zinc-800"
    >
      <MemeImage
        src={memeImageUrl(meme)}
        alt={memeAlt(meme)}
        topText={meme.top_text}
        bottomText={meme.bottom_text}
        variant="thumb"
      />

      <span className="flex flex-1 flex-col gap-2 p-4">
        <span className="line-clamp-2 font-medium leading-snug group-hover:underline">{meme.title}</span>

        <span className="flex flex-wrap gap-1.5">
          {meme.user_id ? (
            <Badge>👤 {memeAuthor(meme)}</Badge>
          ) : (
            <Badge tone="amber">🖼️ Classic</Badge>
          )}
          {meme.members_only && <MembersOnlyBadge />}
        </span>

        <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          <VoteTally upvotes={meme.upvotes} downvotes={meme.downvotes} />
          <Badge tone={scoreTone(meme.score)}>Score {signedScore(meme.score)}</Badge>
          <time dateTime={meme.created_at} title={formatDateTime(meme.created_at)}>
            {timeAgo(meme.created_at)}
          </time>
        </span>
      </span>
    </Link>
  );
}
