import Link from "next/link";
import { Card, EmptyState, ErrorNote, hrefWith } from "@/components/ui";
import { vibeLabel } from "@/lib/captions";
import { formatNumber, signedScore } from "@/lib/format";
import { photoUrl } from "@/lib/storage";
import { timeAgo } from "@/lib/time";
import { type UserPhoto } from "./data";
import { SeeAllLink } from "./see-all-link";

// A user's newest AI-captioned photos, each opening its admin page.
export function UserPhotos({
  userId,
  photos,
  total,
  error,
}: {
  userId: string;
  photos: UserPhoto[];
  total: number;
  error: string | null;
}) {
  return (
    <Card
      title="AI photos"
      description={
        photos.length > 0 && total > photos.length
          ? `Newest ${photos.length} of ${formatNumber(total)}`
          : "Photos they posted for Gemini to caption"
      }
      actions={total > 0 && <SeeAllLink href={hrefWith("/media", { user: userId })} label="AI photos by this user" />}
    >
      {error ? (
        <ErrorNote>Couldn&apos;t load their photos: {error}</ErrorNote>
      ) : photos.length === 0 ? (
        <EmptyState>No AI photos yet.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {photos.map((photo) => (
            <li key={photo.id}>
              <Link
                href={`/media/${photo.id}`}
                className="group block h-full overflow-hidden rounded-xl border border-zinc-200 bg-surface shadow-sm transition hover:shadow-md dark:border-zinc-800"
              >
                <span className="relative block aspect-square overflow-hidden bg-zinc-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl(photo.image_path)}
                    alt={photo.location ? `Photo from ${photo.location}` : "Uploaded photo"}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                  <span
                    title={`👍 ${formatNumber(photo.upvotes)} · 👎 ${formatNumber(photo.downvotes)}`}
                    className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-900 shadow-sm"
                  >
                    {signedScore(photo.score)}
                  </span>
                </span>
                <span className="block px-3 py-2">
                  <span className="line-clamp-2 text-sm font-medium">
                    {photo.top_caption ?? <span className="italic text-zinc-500">No captions</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-zinc-500">
                    {vibeLabel(photo.vibe)}
                  </span>
                  <span className="block truncate text-xs tabular-nums text-zinc-500">
                    👍 {formatNumber(photo.upvotes)} · 👎 {formatNumber(photo.downvotes)} ·{" "}
                    {timeAgo(photo.created_at)}
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
