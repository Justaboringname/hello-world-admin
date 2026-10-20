import Link from "next/link";
import { Badge, Card, EmptyState, ErrorNote, hrefWith } from "@/components/ui";
import { formatNumber, signedScore } from "@/lib/format";
import { memeImageUrl } from "@/lib/storage";
import { timeAgo } from "@/lib/time";
import { type UserMeme } from "./data";
import { SeeAllLink } from "./see-all-link";

// Same outlined caps as the main app's memes, scaled down for a thumbnail.
const memeText =
  "pointer-events-none absolute inset-x-1.5 break-words text-center text-sm font-black uppercase leading-tight text-white [text-shadow:_1px_1px_0_#000,_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000]";

// A user's newest memes, each opening its admin page.
export function UserMemes({
  userId,
  memes,
  total,
  error,
}: {
  userId: string;
  memes: UserMeme[];
  total: number;
  error: string | null;
}) {
  return (
    <Card
      title="Memes"
      description={
        memes.length > 0 && total > memes.length ? `Newest ${memes.length} of ${formatNumber(total)}` : "Memes they made"
      }
      actions={total > 0 && <SeeAllLink href={hrefWith("/memes", { user: userId })} label="memes by this user" />}
    >
      {error ? (
        <ErrorNote>Couldn&apos;t load their memes: {error}</ErrorNote>
      ) : memes.length === 0 ? (
        <EmptyState>No memes yet.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {memes.map((meme) => (
            <li key={meme.id}>
              <Link
                href={`/memes/${meme.id}`}
                className="group block h-full overflow-hidden rounded-xl border border-zinc-200 bg-surface shadow-sm transition hover:shadow-md dark:border-zinc-800"
              >
                <span className="relative block aspect-[4/3] overflow-hidden bg-zinc-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={memeImageUrl(meme)}
                    alt={`Meme: ${meme.title}`}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                  {meme.top_text && <span className={`${memeText} top-1.5`}>{meme.top_text}</span>}
                  {meme.bottom_text && (
                    <span className={`${memeText} bottom-1.5`}>{meme.bottom_text}</span>
                  )}
                </span>
                <span className="block px-3 py-2">
                  {/* The score sits here, not on the image, where the meme's
                      own top text would cover it. */}
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:underline">
                      {meme.title}
                    </span>
                    <span
                      title={`Score: 👍 ${formatNumber(meme.upvotes)} · 👎 ${formatNumber(meme.downvotes)}`}
                      className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold tabular-nums dark:bg-zinc-800"
                    >
                      {signedScore(meme.score)}
                    </span>
                  </span>
                  {meme.members_only && (
                    <span className="mt-1 block">
                      <Badge tone="blue">🔓 Members only</Badge>
                    </span>
                  )}
                  <span className="mt-0.5 block truncate text-xs tabular-nums text-zinc-500">
                    👍 {formatNumber(meme.upvotes)} · 👎 {formatNumber(meme.downvotes)} ·{" "}
                    {timeAgo(meme.created_at)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
