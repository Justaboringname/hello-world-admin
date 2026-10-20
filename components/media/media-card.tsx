import Link from "next/link";
import { Badge } from "@/components/ui";
import { vibeLabel } from "@/lib/captions";
import { formatNumber, scoreTone, signedScore } from "@/lib/format";
import { photoUrl } from "@/lib/storage";
import { timeAgo } from "@/lib/time";
import { MANUAL_MODEL, photoAlt, plural, type MediaRow } from "./data";
import { VoteTally } from "./vote-tally";

// One photo in the /media grid. The whole card opens its admin page.
export function MediaCard({ photo }: { photo: MediaRow }) {
  const votes = photo.upvotes + photo.downvotes;

  return (
    <Link
      href={`/media/${photo.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-surface shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-800"
    >
      <span className="relative block aspect-[4/3] overflow-hidden bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl(photo.image_path)}
          alt={photoAlt(photo)}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <span
          title={`👍 ${formatNumber(photo.upvotes)} · 👎 ${formatNumber(photo.downvotes)}`}
          className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-900 shadow-sm"
        >
          {votes ? signedScore(photo.score) : "No votes"}
        </span>
      </span>

      <span className="flex flex-1 flex-col gap-2 p-4">
        <span className="line-clamp-2 font-medium leading-snug">
          {photo.top_caption ? (
            <>“{photo.top_caption}”</>
          ) : (
            <span className="italic text-zinc-500">No captions</span>
          )}
        </span>

        <span className="flex flex-wrap gap-1.5">
          <Badge>{vibeLabel(photo.vibe)}</Badge>
          <Badge tone={photo.model === MANUAL_MODEL ? "amber" : "violet"}>
            {photo.model === MANUAL_MODEL ? "✍️ Written by an admin" : photo.model}
          </Badge>
        </span>

        <span className="mt-auto flex flex-col gap-1 text-xs text-zinc-500">
          <span className="truncate">
            {photo.location && <>📍 {photo.location} · </>}
            {photo.author_name ? `by ${photo.author_name}` : "by an unnamed user"} ·{" "}
            {timeAgo(photo.created_at)}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
            <span>{plural(photo.caption_count, "caption", "captions")}</span>
            <VoteTally upvotes={photo.upvotes} downvotes={photo.downvotes} />
            <Badge tone={scoreTone(photo.score)}>Score {signedScore(photo.score)}</Badge>
          </span>
        </span>
      </span>
    </Link>
  );
}
