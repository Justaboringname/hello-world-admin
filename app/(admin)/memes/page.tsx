import type { Metadata } from "next";
import Link from "next/link";
import {
  DEFAULT_MEME_SHOW,
  DEFAULT_MEME_SORT,
  MEME_COLUMNS,
  MEME_SEARCH_COLUMNS,
  MEME_SHOWS,
  MEME_SORTS,
  oneOf,
  type MemeRow,
  type MemeShow,
  type MemeSort,
} from "@/components/memes/data";
import { FlashBanner } from "@/components/flash-banner";
import { MemeCard } from "@/components/memes/meme-card";
import {
  EmptyState,
  ErrorNote,
  FilterTabs,
  PageHeader,
  Pagination,
  SearchBox,
  hrefWith,
} from "@/components/ui";
import { UserChip } from "@/components/votes/user-chip";
import { requireAdmin } from "@/lib/auth";
import { cleanSearch, formatNumber, pageIndex, parseUuid } from "@/lib/format";
import { firstParam } from "@/lib/redirect";
import { searchOr } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import { userLabel } from "@/lib/users";

export const metadata: Metadata = { title: "Memes" };

// Divides evenly into 2, 3 and 4 columns.
const PAGE_SIZE = 24;
// Each word must match somewhere, so "drake guest" finds the Drake meme
// about browsing as a guest. Capped so one search can't grow a huge URL.
const MAX_SEARCH_WORDS = 5;

const linkClass = "font-medium text-blue-600 hover:underline dark:text-blue-400";

export default async function MemesPage({ searchParams }: PageProps<"/memes">) {
  await requireAdmin("/memes");
  const params = await searchParams;
  const q = cleanSearch(firstParam(params.q));
  const show = oneOf(MEME_SHOWS, firstParam(params.show), DEFAULT_MEME_SHOW);
  const sort = oneOf(MEME_SORTS, firstParam(params.sort), DEFAULT_MEME_SORT);
  const userId = parseUuid(firstParam(params.user));
  const page = pageIndex(firstParam(params.page));
  const deleted = firstParam(params.deleted) === "1";

  const supabase = await createClient();

  let query = supabase.from("memes").select(MEME_COLUMNS, { count: "exact" });
  for (const word of q.split(" ").slice(0, MAX_SEARCH_WORDS)) {
    const filter = searchOr(MEME_SEARCH_COLUMNS, word);
    if (filter) query = query.or(filter);
  }
  if (show === "members") query = query.eq("members_only", true);
  if (show === "users") query = query.not("user_id", "is", null);
  if (show === "classics") query = query.is("user_id", null);
  if (userId) query = query.eq("user_id", userId);

  if (sort === "top") query = query.order("score", { ascending: false }).order("upvotes", { ascending: false });
  if (sort === "bottom") query = query.order("score", { ascending: true }).order("downvotes", { ascending: false });
  // Newest first breaks ties; the unique id keeps rows from swapping pages
  // (the seeded classics all share one created_at).
  query = query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const [result, chipLabel] = await Promise.all([
    query,
    // Just for the filter chip's label.
    userId ? userLabel(supabase, userId) : null,
  ]);

  const memes = (result.data ?? []) as MemeRow[];
  const matched = result.count ?? memes.length;
  // PGRST103: a ?page= past the last page.
  const pastEnd = result.error?.code === "PGRST103" || (!result.error && !memes.length && page > 0);
  const error = pastEnd ? null : result.error;
  const userName = chipLabel || memes[0]?.author_name || "this user";

  const linkParams = {
    q: q || undefined,
    show: show === DEFAULT_MEME_SHOW ? undefined : show,
    sort: sort === DEFAULT_MEME_SORT ? undefined : sort,
    user: userId ?? undefined,
  };
  const showTabs = (Object.keys(MEME_SHOWS) as MemeShow[]).map((key) => ({
    href: hrefWith("/memes", { ...linkParams, show: key === DEFAULT_MEME_SHOW ? undefined : key }),
    label: MEME_SHOWS[key],
    active: key === show,
  }));
  const sortTabs = (Object.keys(MEME_SORTS) as MemeSort[]).map((key) => ({
    href: hrefWith("/memes", { ...linkParams, sort: key === DEFAULT_MEME_SORT ? undefined : key }),
    label: MEME_SORTS[key],
    active: key === sort,
  }));
  const filtered = Boolean(q || userId || show !== DEFAULT_MEME_SHOW);
  // Sorting isn't filtering, so clearing keeps the order.
  const clearHref = hrefWith("/memes", { sort: linkParams.sort });

  return (
    <>
      {deleted && (
        <FlashBanner param="deleted" title="🗑️ Meme deleted">
          Its votes are gone too.
        </FlashBanner>
      )}

      <PageHeader
        title="Memes"
        description="Memes people posted in the main app, plus the classics it came with. Open one to edit its text, make it members-only, or delete it."
      />

      <div className="mb-5 flex flex-col gap-3">
        <SearchBox
          action="/memes"
          defaultValue={q}
          placeholder="Search titles, meme text, authors"
          hidden={{ show: linkParams.show, sort: linkParams.sort, user: linkParams.user }}
        />
        <FilterTabs label="Which memes" items={showTabs} />
        <FilterTabs label="Sort memes" items={sortTabs} />
        {userId && (
          <UserChip
            prefix="Posted by"
            userId={userId}
            name={userName}
            clearHref={hrefWith("/memes", { ...linkParams, user: undefined })}
            clearLabel={`Show memes by everyone, not just ${userName}`}
          />
        )}
      </div>

      {error ? (
        <ErrorNote>Couldn&apos;t load memes: {error.message}</ErrorNote>
      ) : pastEnd ? (
        <EmptyState>
          There&apos;s nothing on page {page + 1}.{" "}
          <Link href={hrefWith("/memes", linkParams)} className={linkClass}>
            Go to the first page
          </Link>
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
            <span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatNumber(matched)}</span>{" "}
              {matched === 1 ? "meme" : "memes"}
              {q && <> matching “{q}”</>}
            </span>
            {filtered && (
              <Link href={clearHref} className={linkClass}>
                Clear filters
              </Link>
            )}
            {matched > PAGE_SIZE && (
              <span>
                · showing {formatNumber(page * PAGE_SIZE + 1)}–{formatNumber(page * PAGE_SIZE + memes.length)}
              </span>
            )}
          </p>

          {memes.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {memes.map((meme) => (
                <li key={meme.id}>
                  <MemeCard meme={meme} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>
              {filtered ? (
                <>
                  No memes match these filters.{" "}
                  <Link href={clearHref} className={linkClass}>
                    Show every meme
                  </Link>
                </>
              ) : (
                "There are no memes yet. People post them from the main app."
              )}
            </EmptyState>
          )}

          <Pagination path="/memes" params={linkParams} page={page} pageSize={PAGE_SIZE} total={matched} />
        </>
      )}
    </>
  );
}
