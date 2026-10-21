import Link from "next/link";
import { MembersOnlyBadge } from "@/components/memes/members-only-badge";
import { UpDownBar } from "@/components/up-down-bar";
import { VoteTally } from "@/components/vote-tally";
import { vibeLabel } from "@/lib/captions";
import type { Dashboard, RankedCaption } from "@/lib/dashboard";
import { displayName, signedScore } from "@/lib/format";
import { memeImageUrl, photoUrl } from "@/lib/storage";
import { ordinal } from "./numbers";

const rowClass =
  "flex items-start gap-3 rounded-xl p-2 transition hover:bg-zinc-50 focus-visible:bg-zinc-50 dark:hover:bg-white/5 dark:focus-visible:bg-white/5";

function Thumb({ src, alt }: { src: string; alt: string }) {
  if (!src) {
    return (
      <span
        aria-hidden
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xl dark:bg-zinc-800"
      >
        🖼️
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="h-14 w-14 shrink-0 rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800"
    />
  );
}

// Captions with their photo. "top" leads with the score; "divisive" leads
// with how evenly the room split.
export function CaptionList({
  captions,
  variant,
}: {
  captions: RankedCaption[];
  variant: "top" | "divisive";
}) {
  return (
    <ol className="-mx-2 space-y-1">
      {captions.map((caption) => (
        <li key={caption.id}>
          <Link href={`/media/${caption.generation_id}`} className={rowClass}>
            <Thumb
              src={photoUrl(caption.image_path)}
              alt={caption.author_name ? `Photo by ${caption.author_name}` : "The captioned photo"}
            />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm leading-snug">“{caption.text}”</p>
              <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                {vibeLabel(caption.vibe)} · {ordinal(caption.position)} caption
              </p>
              {variant === "divisive" && (
                <div className="mt-1.5">
                  <UpDownBar up={caption.upvotes} down={caption.downvotes} />
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              {variant === "top" ? (
                <>
                  <p className="text-sm font-semibold tabular-nums">{signedScore(caption.score)}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    <VoteTally upvotes={caption.upvotes} downvotes={caption.downvotes} />
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">
                    <VoteTally upvotes={caption.upvotes} downvotes={caption.downvotes} />
                  </p>
                  <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    score {signedScore(caption.score)}
                  </p>
                </>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function MemeList({ memes }: { memes: Dashboard["top_memes"] }) {
  return (
    <ol className="-mx-2 space-y-1">
      {memes.map((meme) => {
        // The seeded classics have no author and live on imgflip.
        const byline = (meme.author_name || meme.image_path) ? displayName(meme.author_name) : "Classic";
        return (
          <li key={meme.id}>
            <Link href={`/memes/${meme.id}`} className={rowClass}>
              <Thumb src={memeImageUrl(meme)} alt={`Meme: ${meme.title}`} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium leading-snug">{meme.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="truncate">{byline}</span>
                  {meme.members_only && <MembersOnlyBadge />}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{signedScore(meme.score)}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  <VoteTally upvotes={meme.upvotes} downvotes={meme.downvotes} />
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
