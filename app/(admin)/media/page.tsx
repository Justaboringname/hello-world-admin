import type { Metadata } from "next";
import Link from "next/link";
import {
  DEFAULT_MEDIA_SORT,
  MEDIA_ROW_COLUMNS,
  MEDIA_SEARCH_COLUMNS,
  MEDIA_SORTS,
  parseMediaSort,
  type MediaRow,
  type MediaSort,
} from "@/components/media/data";
import { FlashBanner } from "@/components/flash-banner";
import { MediaCard } from "@/components/media/media-card";
import {
  EmptyState,
  FilterTabs,
  LoadError,
  PageHeader,
  Pagination,
  SearchBox,
  hrefWith,
  linkClass,
} from "@/components/ui";
import { UserChip } from "@/components/user-chip";
import { requireAdmin } from "@/lib/auth";
import { VIBES, isVibe, vibeLabel, type Vibe } from "@/lib/captions";
import { cleanSearch, formatNumber, pageIndex, parseUuid } from "@/lib/format";
import { firstParam } from "@/lib/redirect";
import { searchOr } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import { userLabel } from "@/lib/users";

export const metadata: Metadata = { title: "AI media" };

// Divides evenly into 2, 3 and 4 columns.
const PAGE_SIZE = 24;
// Each word must match somewhere, so "times square rat" finds a rat caption
// posted from Times Square. Capped so one search can't grow a huge URL.
const MAX_SEARCH_WORDS = 5;

export default async function MediaPage({ searchParams }: PageProps<"/media">) {
  await requireAdmin("/media");
  const params = await searchParams;
  const q = cleanSearch(firstParam(params.q));
  const vibeParam = firstParam(params.vibe);
  const vibe: Vibe | undefined = isVibe(vibeParam) ? vibeParam : undefined;
  const sort = parseMediaSort(firstParam(params.sort));
  const userId = parseUuid(firstParam(params.user));
  const page = pageIndex(firstParam(params.page));
  const deleted = firstParam(params.deleted) === "1";

  const supabase = await createClient();

  let query = supabase.from("admin_generations").select(MEDIA_ROW_COLUMNS, { count: "exact" });
  for (const word of q.split(" ").slice(0, MAX_SEARCH_WORDS)) {
    const filter = searchOr(MEDIA_SEARCH_COLUMNS, word);
    if (filter) query = query.or(filter);
  }
  if (vibe) query = query.eq("vibe", vibe);
  if (userId) query = query.eq("user_id", userId);
  if (sort === "unvoted") query = query.eq("upvotes", 0).eq("downvotes", 0);

  if (sort === "old") {
    query = query.order("created_at", { ascending: true }).order("id", { ascending: true });
  } else {
    if (sort === "top") query = query.order("score", { ascending: false }).order("upvotes", { ascending: false });
    if (sort === "bottom") query = query.order("score", { ascending: true }).order("downvotes", { ascending: false });
    // Newest first breaks ties; the unique id keeps rows from swapping pages.
    query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
  }
  query = query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const [result, chipLabel] = await Promise.all([
    query,
    // Just for the filter chip's label.
    userId ? userLabel(supabase, userId) : null,
  ]);

  const photos = (result.data ?? []) as MediaRow[];
  const matched = result.count ?? photos.length;
  // PGRST103: a ?page= past the last page.
  const pastEnd = result.error?.code === "PGRST103" || (!result.error && !photos.length && page > 0);
  const error = pastEnd ? null : result.error;
  const userName = chipLabel || photos[0]?.author_name || "this user";

  const linkParams = {
    q: q || undefined,
    vibe,
    sort: sort === DEFAULT_MEDIA_SORT ? undefined : sort,
    user: userId ?? undefined,
  };
  const vibeTabs = [
    { href: hrefWith("/media", { ...linkParams, vibe: undefined }), label: "All vibes", active: !vibe },
    ...(Object.keys(VIBES) as Vibe[]).map((key) => ({
      href: hrefWith("/media", { ...linkParams, vibe: key }),
      label: vibeLabel(key),
      active: key === vibe,
    })),
  ];
  const sortTabs = (Object.keys(MEDIA_SORTS) as MediaSort[]).map((key) => ({
    href: hrefWith("/media", { ...linkParams, sort: key === DEFAULT_MEDIA_SORT ? undefined : key }),
    label: MEDIA_SORTS[key],
    active: key === sort,
  }));
  const filtered = Boolean(q || vibe || userId || sort === "unvoted");
  // Sorting isn't filtering, except "No votes yet", which hides photos.
  const clearHref = hrefWith("/media", { sort: sort === "unvoted" ? undefined : linkParams.sort });
  const first = page * PAGE_SIZE + 1;
  const last = page * PAGE_SIZE + photos.length;

  return (
    <>
      {deleted && (
        <FlashBanner param="deleted" title="🗑️ Photo deleted">
          Its captions and their votes are gone too.
        </FlashBanner>
      )}

      <PageHeader
        title="AI media"
        description="Every photo people posted for Gemini to caption, with the captions' votes. Open one to edit its details and captions, or to delete it."
        actions={
          <Link
            href="/media/new"
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
          >
            + New AI photo
          </Link>
        }
      />

      <div className="mb-5 flex flex-col gap-3">
        <SearchBox
          action="/media"
          defaultValue={q}
          placeholder="Search captions, places, authors"
          hidden={{ vibe: linkParams.vibe, sort: linkParams.sort, user: linkParams.user }}
        />
        <FilterTabs label="Filter by vibe" items={vibeTabs} />
        <FilterTabs label="Sort photos" items={sortTabs} />
        {userId && (
          <UserChip
            prefix="Posted by"
            userId={userId}
            name={userName}
            clearHref={hrefWith("/media", { ...linkParams, user: undefined })}
            clearLabel={`Show photos by everyone, not just ${userName}`}
          />
        )}
      </div>

      {error ? (
        <LoadError what="photos" error={error} />
      ) : pastEnd ? (
        <EmptyState>
          There&apos;s nothing on page {page + 1}.{" "}
          <Link href={hrefWith("/media", linkParams)} className={linkClass}>
            Go to the first page
          </Link>
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
            <span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatNumber(matched)}</span>{" "}
              {matched === 1 ? "photo" : "photos"}
              {q && <> matching “{q}”</>}
            </span>
            {filtered && (
              <Link href={clearHref} className={linkClass}>
                Clear filters
              </Link>
            )}
            {matched > PAGE_SIZE && (
              <span>
                · showing {formatNumber(first)}–{formatNumber(last)}
              </span>
            )}
          </p>

          {photos.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {photos.map((photo) => (
                <li key={photo.id}>
                  <MediaCard photo={photo} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>
              {filtered ? (
                <>
                  No photos match these filters.{" "}
                  <Link href={clearHref} className={linkClass}>
                    Show every photo
                  </Link>
                </>
              ) : (
                <>
                  No one has posted a photo yet.{" "}
                  <Link href="/media/new" className={linkClass}>
                    Post the first one
                  </Link>
                </>
              )}
            </EmptyState>
          )}

          <Pagination path="/media" params={linkParams} page={page} pageSize={PAGE_SIZE} total={matched} />
        </>
      )}
    </>
  );
}
