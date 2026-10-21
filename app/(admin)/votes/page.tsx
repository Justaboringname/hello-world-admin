import type { Metadata } from "next";
import Link from "next/link";
import {
  EmptyState,
  ErrorNote,
  FilterTabs,
  PageHeader,
  Pagination,
  SearchBox,
  hrefWith,
} from "@/components/ui";
import { oneOf } from "@/components/memes/data";
import {
  CAPTION_RATING_COLUMNS,
  DEFAULT_RATING_SORT,
  DEFAULT_VOTE_FILTER,
  DEFAULT_VOTE_KIND,
  DEFAULT_VOTE_TAB,
  MEME_RATING_COLUMNS,
  RATING_SORTS,
  VOTE_COLUMNS,
  VOTE_KINDS,
  VOTE_TABS,
  VOTE_VALUES,
  ratingOrder,
  type CaptionRating,
  type MemeRating,
  type RatingSort,
  type VoteFilter,
  type VoteKind,
  type VoteRow,
} from "@/components/votes/data";
import { RatingsList, captionItem, memeItem } from "@/components/votes/ratings-list";
import { SummaryTiles, type VoteSummary } from "@/components/votes/summary-tiles";
import { UserChip } from "@/components/votes/user-chip";
import { VotesTable } from "@/components/votes/votes-table";
import { requireAdmin } from "@/lib/auth";
import { cleanSearch, formatNumber, pageIndex, parseUuid } from "@/lib/format";
import { firstParam } from "@/lib/redirect";
import { containsPattern } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import { userLabel } from "@/lib/users";

export const metadata: Metadata = { title: "Votes" };

const VOTES_PAGE_SIZE = 50;
const RATINGS_PAGE_SIZE = 25;

const linkClass = "font-medium text-blue-600 hover:underline dark:text-blue-400";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type QueryError = { code?: string; message: string } | null;

// Five counts, all HEAD requests, so no rows cross the wire.
async function loadSummary(supabase: Supabase): Promise<VoteSummary> {
  const count = () => supabase.from("admin_votes").select("kind", { count: "exact", head: true });
  const [up, down, captions, memes, voters] = await Promise.all([
    count().eq("vote", 1),
    count().eq("vote", -1),
    count().eq("kind", "caption"),
    count().eq("kind", "meme"),
    // admin_users() already counts each user's votes, so anyone with at
    // least one is a voter. Fine at class size: it's one row per user.
    supabase.rpc("admin_users", {}, { count: "exact", head: true }).gt("votes_cast", 0),
  ]);
  // HEAD responses carry no error body, so a missing count is the failure.
  const value = (result: { count: number | null; error: unknown }) =>
    result.error ? null : result.count;
  return {
    up: value(up),
    down: value(down),
    captions: value(captions),
    memes: value(memes),
    voters: value(voters),
  };
}

// Its own component so React loads it alongside the tab's rows.
async function Summary({ supabase }: { supabase: Supabase }) {
  return <SummaryTiles summary={await loadSummary(supabase)} />;
}

function LoadError({ what, error }: { what: string; error: NonNullable<QueryError> }) {
  return (
    <ErrorNote>
      Couldn&apos;t load {what}: {error.message || "the database didn't answer."}
      {error.code === "PGRST205" && " Has admin/supabase/admin.sql been run in the SQL Editor?"}
    </ErrorNote>
  );
}

function PastEnd({ page, firstPageHref }: { page: number; firstPageHref: string }) {
  return (
    <EmptyState>
      There&apos;s nothing on page {page + 1}.{" "}
      <Link href={firstPageHref} className={linkClass}>
        Go to the first page
      </Link>
    </EmptyState>
  );
}

// "1,234 votes · showing 51–100"
function ResultCount({
  total,
  shown,
  page,
  pageSize,
  noun,
  q,
  clearHref,
}: {
  total: number;
  shown: number;
  page: number;
  pageSize: number;
  noun: [string, string];
  q: string;
  clearHref?: string;
}) {
  return (
    <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
      <span>
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatNumber(total)}</span>{" "}
        {total === 1 ? noun[0] : noun[1]}
        {q && <> matching “{q}”</>}
      </span>
      {clearHref && (
        <Link href={clearHref} className={linkClass}>
          Clear filters
        </Link>
      )}
      {total > pageSize && shown > 0 && (
        <span>
          · showing {formatNumber(page * pageSize + 1)}–{formatNumber(page * pageSize + shown)}
        </span>
      )}
    </p>
  );
}

export default async function VotesPage({ searchParams }: PageProps<"/votes">) {
  await requireAdmin("/votes");
  const params = await searchParams;
  const tab = oneOf(VOTE_TABS, firstParam(params.tab), DEFAULT_VOTE_TAB);
  const kind = oneOf(VOTE_KINDS, firstParam(params.kind), DEFAULT_VOTE_KIND);
  const vote = oneOf(VOTE_VALUES, firstParam(params.vote), DEFAULT_VOTE_FILTER);
  const sort = oneOf(RATING_SORTS, firstParam(params.sort), DEFAULT_RATING_SORT);
  const userId = parseUuid(firstParam(params.user));
  const q = cleanSearch(firstParam(params.q));
  const page = pageIndex(firstParam(params.page));

  const supabase = await createClient();
  const filters = { supabase, kind, vote, sort, userId, q, page };

  // Switching tabs keeps what still applies there: the search, and the kind
  // when it's one the other tab has. Voter and 👍/👎 only mean something for
  // single votes, and the ranking order only for ratings.
  const tabs = [
    {
      href: hrefWith("/votes", {
        kind: kind === DEFAULT_VOTE_KIND ? undefined : kind,
        vote: vote === DEFAULT_VOTE_FILTER ? undefined : vote,
        user: userId ?? undefined,
        q: q || undefined,
      }),
      label: VOTE_TABS.votes,
      active: tab === "votes",
    },
    {
      href: hrefWith("/votes", {
        tab: "ratings",
        kind: kind === "meme" ? kind : undefined,
        sort: sort === DEFAULT_RATING_SORT ? undefined : sort,
        q: q || undefined,
      }),
      label: VOTE_TABS.ratings,
      active: tab === "ratings",
    },
  ];

  return (
    <>
      <PageHeader
        title="Votes"
        description="Every 👍 and 👎 people gave AI captions and memes, and how each caption and meme is rated overall."
      />
      <Summary supabase={supabase} />
      <div className="mb-5">
        <FilterTabs label="Votes view" items={tabs} />
      </div>
      {tab === "ratings" ? <Ratings {...filters} /> : <AllVotes {...filters} />}
    </>
  );
}

type TabProps = {
  supabase: Supabase;
  kind: VoteKind;
  vote: VoteFilter;
  sort: RatingSort;
  userId: string | null;
  q: string;
  page: number;
};

// ALL VOTES ---------------------------------------------------------------------

async function AllVotes({ supabase, kind, vote, userId, q, page }: TabProps) {
  let query = supabase.from("admin_votes").select(VOTE_COLUMNS, { count: "exact" });
  if (kind !== "all") query = query.eq("kind", kind);
  if (vote !== "all") query = query.eq("vote", vote === "up" ? 1 : -1);
  if (userId) query = query.eq("user_id", userId);
  if (q) query = query.ilike("label", containsPattern(q));
  query = query
    .order("created_at", { ascending: false })
    // One vote per item and voter, so these make the order total and keep
    // rows cast in the same instant from swapping between pages.
    .order("kind", { ascending: true })
    .order("item_id", { ascending: true })
    .order("user_id", { ascending: true })
    .range(page * VOTES_PAGE_SIZE, page * VOTES_PAGE_SIZE + VOTES_PAGE_SIZE - 1);

  const [result, chipLabel] = await Promise.all([
    query,
    // Just for the filter chip's label.
    userId ? userLabel(supabase, userId) : null,
  ]);

  const votes = (result.data ?? []) as VoteRow[];
  const total = result.count ?? votes.length;
  // PGRST103: a ?page= past the last page.
  const pastEnd = result.error?.code === "PGRST103" || (!result.error && !votes.length && page > 0);
  const error = pastEnd ? null : (result.error as QueryError);
  const userName = chipLabel || votes[0]?.voter_name || "this user";

  const linkParams = {
    kind: kind === DEFAULT_VOTE_KIND ? undefined : kind,
    vote: vote === DEFAULT_VOTE_FILTER ? undefined : vote,
    user: userId ?? undefined,
    q: q || undefined,
  };
  const kindTabs = (Object.keys(VOTE_KINDS) as VoteKind[]).map((key) => ({
    href: hrefWith("/votes", { ...linkParams, kind: key === DEFAULT_VOTE_KIND ? undefined : key }),
    label: VOTE_KINDS[key],
    active: key === kind,
  }));
  const voteTabs = (Object.keys(VOTE_VALUES) as VoteFilter[]).map((key) => ({
    href: hrefWith("/votes", { ...linkParams, vote: key === DEFAULT_VOTE_FILTER ? undefined : key }),
    label: VOTE_VALUES[key],
    active: key === vote,
  }));
  const filtered = Boolean(q || userId || kind !== DEFAULT_VOTE_KIND || vote !== DEFAULT_VOTE_FILTER);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3">
        <SearchBox
          action="/votes"
          defaultValue={q}
          placeholder="Search caption text and meme titles"
          hidden={{ kind: linkParams.kind, vote: linkParams.vote, user: linkParams.user }}
        />
        <div className="flex flex-wrap gap-x-4 gap-y-3">
          <FilterTabs label="Filter by what was voted on" items={kindTabs} />
          <FilterTabs label="Filter by vote" items={voteTabs} />
        </div>
        {userId && (
          <UserChip
            prefix="Voted by"
            userId={userId}
            name={userName}
            clearHref={hrefWith("/votes", { ...linkParams, user: undefined })}
            clearLabel={`Show votes by everyone, not just ${userName}`}
          />
        )}
      </div>

      {error ? (
        <LoadError what="votes" error={error} />
      ) : pastEnd ? (
        <PastEnd page={page} firstPageHref={hrefWith("/votes", linkParams)} />
      ) : (
        <>
          <ResultCount
            total={total}
            shown={votes.length}
            page={page}
            pageSize={VOTES_PAGE_SIZE}
            noun={["vote", "votes"]}
            q={q}
            clearHref={filtered ? "/votes" : undefined}
          />
          {votes.length ? (
            <VotesTable votes={votes} />
          ) : (
            <EmptyState>
              {filtered ? (
                <>
                  No votes match these filters.{" "}
                  <Link href="/votes" className={linkClass}>
                    Show every vote
                  </Link>
                </>
              ) : (
                "No one has voted yet."
              )}
            </EmptyState>
          )}
          <Pagination path="/votes" params={linkParams} page={page} pageSize={VOTES_PAGE_SIZE} total={total} />
        </>
      )}
    </>
  );
}

// RATINGS -----------------------------------------------------------------------

async function Ratings({ supabase, kind, sort, q, page }: TabProps) {
  // Ratings are per caption or per meme, so "everything" shows captions.
  const ratingKind = kind === "meme" ? "meme" : "caption";

  let query =
    ratingKind === "caption"
      ? supabase.from("captions").select(CAPTION_RATING_COLUMNS, { count: "exact" })
      : supabase.from("memes").select(MEME_RATING_COLUMNS, { count: "exact" });
  // Only what has been rated: with no votes there's nothing to rank. Divisive
  // needs votes on both sides.
  query =
    sort === "divisive"
      ? query.gt("upvotes", 0).gt("downvotes", 0)
      : query.or("upvotes.gt.0,downvotes.gt.0");
  if (q) query = query.ilike(ratingKind === "caption" ? "text" : "title", containsPattern(q));
  for (const { column, ascending } of ratingOrder(sort)) query = query.order(column, { ascending });
  query = query
    .order("id", { ascending: true })
    .range(page * RATINGS_PAGE_SIZE, page * RATINGS_PAGE_SIZE + RATINGS_PAGE_SIZE - 1);

  const result = await query;
  const rows = (result.data ?? []) as unknown[];
  const total = result.count ?? rows.length;
  const pastEnd = result.error?.code === "PGRST103" || (!result.error && !rows.length && page > 0);
  const error = pastEnd ? null : (result.error as QueryError);
  const items =
    ratingKind === "caption"
      ? (rows as CaptionRating[]).map(captionItem)
      : (rows as MemeRating[]).map(memeItem);
  const noun: [string, string] =
    ratingKind === "caption" ? ["rated caption", "rated captions"] : ["rated meme", "rated memes"];

  const linkParams = {
    tab: "ratings",
    kind: ratingKind === "meme" ? "meme" : undefined,
    sort: sort === DEFAULT_RATING_SORT ? undefined : sort,
    q: q || undefined,
  };
  const kindTabs = (["caption", "meme"] as const).map((key) => ({
    href: hrefWith("/votes", { ...linkParams, kind: key === "meme" ? key : undefined }),
    label: VOTE_KINDS[key],
    active: key === ratingKind,
  }));
  const sortTabs = (Object.keys(RATING_SORTS) as RatingSort[]).map((key) => ({
    href: hrefWith("/votes", { ...linkParams, sort: key === DEFAULT_RATING_SORT ? undefined : key }),
    label: RATING_SORTS[key],
    active: key === sort,
  }));
  const clearHref = hrefWith("/votes", { ...linkParams, q: undefined });

  return (
    <>
      <div className="mb-5 flex flex-col gap-3">
        <SearchBox
          action="/votes"
          defaultValue={q}
          placeholder={ratingKind === "caption" ? "Search caption text" : "Search meme titles"}
          hidden={{ tab: linkParams.tab, kind: linkParams.kind, sort: linkParams.sort }}
        />
        <div className="flex flex-wrap gap-x-4 gap-y-3">
          <FilterTabs label="Rate captions or memes" items={kindTabs} />
          <FilterTabs label="Rank by" items={sortTabs} />
        </div>
        {sort === "divisive" && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Items with both 👍 and 👎, ranked by the smaller side: the closer the split and the
            more votes, the higher.
          </p>
        )}
      </div>

      {error ? (
        <LoadError what="ratings" error={error} />
      ) : pastEnd ? (
        <PastEnd page={page} firstPageHref={hrefWith("/votes", linkParams)} />
      ) : (
        <>
          <ResultCount
            total={total}
            shown={items.length}
            page={page}
            pageSize={RATINGS_PAGE_SIZE}
            noun={noun}
            q={q}
            clearHref={q ? clearHref : undefined}
          />
          {items.length ? (
            <RatingsList items={items} offset={page * RATINGS_PAGE_SIZE} />
          ) : (
            <EmptyState>
              {q ? (
                <>
                  Nothing rated matches “{q}”.{" "}
                  <Link href={clearHref} className={linkClass}>
                    Clear the search
                  </Link>
                </>
              ) : ratingKind === "caption" ? (
                "No caption has a vote yet."
              ) : (
                "No meme has a vote yet."
              )}
            </EmptyState>
          )}
          <Pagination
            path="/votes"
            params={linkParams}
            page={page}
            pageSize={RATINGS_PAGE_SIZE}
            total={total}
          />
        </>
      )}
    </>
  );
}
