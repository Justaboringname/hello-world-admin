import type { Metadata } from "next";
import Link from "next/link";
import {
  DEFAULT_USER_SORT,
  USER_SORTS,
  parseUserSort,
  type AdminUser,
  type UserSort,
} from "@/components/users/data";
import { UserList } from "@/components/users/user-list";
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
import { requireAdmin } from "@/lib/auth";
import { cleanSearch, formatNumber, pageIndex, plural } from "@/lib/format";
import { firstParam } from "@/lib/redirect";
import { searchOr } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 25;
const SEARCH_COLUMNS = ["email", "first_name", "last_name"] as const;
// Enough for "first last email" without letting one search grow a huge URL.
const MAX_SEARCH_WORDS = 5;

export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  await requireAdmin("/users");
  const params = await searchParams;
  const q = cleanSearch(firstParam(params.q));
  const sort = parseUserSort(firstParam(params.sort));
  const page = pageIndex(firstParam(params.page));

  const supabase = await createClient();

  // admin_users() returns a set, so PostgREST filters, sorts and counts its
  // result like a table.
  let query = supabase.rpc("admin_users", {}, { count: "exact" });
  // One filter per word, and PostgREST ANDs them: "jane doe" finds Jane Doe
  // even though first and last name are separate columns.
  for (const word of q.split(" ").slice(0, MAX_SEARCH_WORDS)) {
    const filter = searchOr(SEARCH_COLUMNS, word);
    if (filter) query = query.or(filter);
  }
  // Never-signed-in users have no last_sign_in_at; they go last, not first.
  query = query.order(USER_SORTS[sort].column, { ascending: false, nullsFirst: false });
  if (sort !== "new") query = query.order("created_at", { ascending: false });
  // A unique last key keeps rows from swapping between pages on ties.
  query = query.order("id").range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const [result, everyone] = await Promise.all([
    query,
    // Without a search the count above already is everyone.
    q ? supabase.rpc("admin_users", {}, { count: "exact", head: true }) : null,
  ]);

  const users = (result.data ?? []) as AdminUser[];
  const matched = result.count ?? users.length;
  // HEAD responses carry no error body, so a missing count is the only sign
  // that the total failed. The page still works without it.
  const total = q ? (everyone?.count ?? null) : matched;
  // PGRST103: a ?page= past the last page.
  const pastEnd = result.error?.code === "PGRST103" || (!result.error && !users.length && page > 0);
  const error = pastEnd ? null : result.error;

  const linkParams = { q: q || undefined, sort: sort === DEFAULT_USER_SORT ? undefined : sort };
  const sortTabs = (Object.keys(USER_SORTS) as UserSort[]).map((key) => ({
    href: hrefWith("/users", { q: linkParams.q, sort: key === DEFAULT_USER_SORT ? undefined : key }),
    label: USER_SORTS[key].label,
    active: key === sort,
  }));
  const first = page * PAGE_SIZE + 1;
  const last = page * PAGE_SIZE + users.length;

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone who has signed in, with what they've posted and how they vote. Read-only: admin access is granted in the Supabase SQL Editor."
      />

      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <SearchBox
          action="/users"
          defaultValue={q}
          placeholder="Search name or email"
          hidden={{ sort: linkParams.sort }}
        />
        <FilterTabs label="Sort users" items={sortTabs} />
      </div>

      {error ? (
        <LoadError what="users" error={error} />
      ) : pastEnd ? (
        <EmptyState>
          There&apos;s nothing on page {page + 1}.{" "}
          <Link href={hrefWith("/users", linkParams)} className={linkClass}>
            Go to the first page
          </Link>
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
            {q ? (
              <>
                <span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatNumber(matched)}
                  </span>{" "}
                  {total !== null ? `of ${plural(total, "user")}` : matched === 1 ? "user" : "users"}{" "}
                  {matched === 1 ? "matches" : "match"} “{q}”
                </span>
                <Link href={hrefWith("/users", { sort: linkParams.sort })} className={linkClass}>
                  Clear search
                </Link>
              </>
            ) : (
              <span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatNumber(matched)}</span>{" "}
                {matched === 1 ? "user" : "users"} in total
              </span>
            )}
            {matched > PAGE_SIZE && (
              <span>
                · showing {formatNumber(first)}–{formatNumber(last)}
              </span>
            )}
          </p>

          {users.length ? (
            <UserList users={users} />
          ) : (
            <EmptyState>
              {q ? `No users match “${q}”. Try part of a name or an email address.` : "No one has signed in yet."}
            </EmptyState>
          )}

          <Pagination path="/users" params={linkParams} page={page} pageSize={PAGE_SIZE} total={matched} />
        </>
      )}
    </>
  );
}
