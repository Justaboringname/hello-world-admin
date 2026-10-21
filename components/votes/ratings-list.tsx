import Link from "next/link";
import { memeAlt, memeAuthor } from "@/components/memes/data";
import { MembersOnlyBadge } from "@/components/memes/members-only-badge";
import { Badge } from "@/components/ui";
import { UpDownBar } from "@/components/up-down-bar";
import { vibeLabel } from "@/lib/captions";
import { formatNumber, scoreTone, signedScore } from "@/lib/format";
import { memeImageUrl, photoUrl } from "@/lib/storage";
import type { CaptionRating, MemeRating } from "./data";

// Captions and memes ranked the same way, so one list renders both.
type RatingItem = {
  key: number;
  href: string;
  image: string;
  imageAlt: string;
  title: React.ReactNode;
  meta: React.ReactNode;
  upvotes: number;
  downvotes: number;
  score: number;
};

export function captionItem(caption: CaptionRating): RatingItem {
  const photo = caption.generations;
  return {
    key: caption.id,
    href: `/media/${caption.generation_id}`,
    image: photo ? photoUrl(photo.image_path) : "",
    imageAlt: photo ? `The photo this caption was written for (${vibeLabel(photo.vibe)})` : "",
    title: <>“{caption.text}”</>,
    meta: (
      <>
        {photo && <Badge>{vibeLabel(photo.vibe)}</Badge>}
        <span>Caption {caption.position} on photo #{caption.generation_id}</span>
      </>
    ),
    upvotes: caption.upvotes,
    downvotes: caption.downvotes,
    score: caption.score,
  };
}

export function memeItem(meme: MemeRating): RatingItem {
  return {
    key: meme.id,
    href: `/memes/${meme.id}`,
    image: memeImageUrl(meme),
    imageAlt: memeAlt(meme),
    title: meme.title,
    meta: (
      <>
        {meme.user_id ? <span>by {memeAuthor(meme)}</span> : <Badge tone="amber">🖼️ Classic</Badge>}
        {meme.members_only && <MembersOnlyBadge />}
      </>
    ),
    upvotes: meme.upvotes,
    downvotes: meme.downvotes,
    score: meme.score,
  };
}

// `offset` is how many items came before this page, for the rank numbers.
export function RatingsList({ items, offset }: { items: RatingItem[]; offset: number }) {
  return (
    <ol className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-surface px-4 shadow-sm dark:divide-zinc-800 dark:border-zinc-800">
      {items.map((item, index) => {
        const votes = item.upvotes + item.downvotes;
        return (
          <li key={item.key} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:gap-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="w-9 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
                #{formatNumber(offset + index + 1)}
              </span>
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt={item.imageAlt}
                  loading="lazy"
                  className="h-12 w-16 shrink-0 rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800"
                />
              ) : (
                <span aria-hidden className="h-12 w-16 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
              )}
              <div className="min-w-0">
                <Link href={item.href} className="line-clamp-2 text-sm font-medium leading-snug hover:underline">
                  {item.title}
                </Link>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {item.meta}
                  <span className="tabular-nums">
                    · {formatNumber(votes)} {votes === 1 ? "vote" : "votes"}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pl-12 sm:w-80 sm:shrink-0 sm:pl-0">
              <div className="min-w-0 flex-1">
                <UpDownBar up={item.upvotes} down={item.downvotes} showCounts />
              </div>
              <span className="w-14 shrink-0 text-right tabular-nums">
                <Badge tone={scoreTone(item.score)}>{signedScore(item.score)}</Badge>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
