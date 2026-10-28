import type { Metadata } from "next";
import Link from "next/link";
import type { MediaDetail } from "@/components/media/data";
import { Badge, EmptyState, FilterTabs, LoadError, PageHeader, Pagination, hrefWith, linkClass } from "@/components/ui";
import { When } from "@/components/users/when";
import { requireAdmin } from "@/lib/auth";
import { MANUAL_MODEL, VIBES, isVibe, vibeLabel, type Vibe } from "@/lib/captions";
import { displayName, formatNumber, pageIndex, plural } from "@/lib/format";
import { firstParam } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Generation requests" };

const PAGE_SIZE = 25;

// A photo row as a request: who asked, with what prompts, and how many
// captions it has. Only the caption ids come along, to count them.
type RequestRow = Omit<MediaDetail, "image_path" | "captions"> & { captions: { id: number }[] };

const REQUEST_COLUMNS =
  "id, user_id, author_name, location, vibe, system_prompt, prompt, model, created_at, captions(id)";

// Same as the prompts on a photo's page: the exact text, line breaks kept.
function Prompt({ label, text, empty }: { label: string; text: string; empty: string }) {
  return (
    <>
      <h3 className="mt-4 text-sm font-medium">{label}</h3>
      {text ? (
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-900">
          {text}
        </pre>
      ) : (
        <p className="mt-1 text-sm italic text-zinc-500 dark:text-zinc-400">{empty}</p>
      )}
    </>
  );
}

// The model that answered. Admins can also write the captions themselves.
function ModelBadge({ model }: { model: string }) {
  return model === MANUAL_MODEL ? (
    <Badge tone="amber">✍️ Written by hand</Badge>
  ) : (
    <Badge tone="violet">
      <span className="font-mono">{model}</span>
    </Badge>
  );
}

// Every photo in generations is one caption request: its prompts, model and
// time are saved with it. Nothing else is logged yet.
export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  await requireAdmin("/requests");
  const params = await searchParams;
  const vibeParam = firstParam(params.vibe);
  const vibe: Vibe | undefined = isVibe(vibeParam) ? vibeParam : undefined;
  const page = pageIndex(firstParam(params.page));

  const supabase = await createClient();

  let query = supabase.from("generations").select(REQUEST_COLUMNS, { count: "exact" });
  if (vibe) query = query.eq("vibe", vibe);
  // The unique id keeps requests made in the same instant from swapping pages.
  const result = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const requests = (result.data ?? []) as RequestRow[];
  const matched = result.count ?? requests.length;
  // PGRST103: a ?page= past the last page.
  const pastEnd = result.error?.code === "PGRST103" || (!result.error && !requests.length && page > 0);
  const error = pastEnd ? null : result.error;

  const linkParams = { vibe };
  const vibeTabs = [
    { href: "/requests", label: "All vibes", active: !vibe },
    ...(Object.keys(VIBES) as Vibe[]).map((key) => ({
      href: hrefWith("/requests", { vibe: key }),
      label: vibeLabel(key),
      active: key === vibe,
    })),
  ];
  const first = page * PAGE_SIZE + 1;
  const last = page * PAGE_SIZE + requests.length;

  return (
    <>
      <PageHeader
        title="Generation requests"
        description="Each photo posted for AI captions is one request, saved with its exact prompts and the model that answered: Claude Opus 5.5, or Gemini when Claude couldn't. Only requests that worked are saved: failed calls aren't logged yet, here or in the main app."
      />

      <div className="mb-5">
        <FilterTabs label="Filter by vibe" items={vibeTabs} />
      </div>

      {error ? (
        <LoadError what="requests" error={error} />
      ) : pastEnd ? (
        <EmptyState>
          There&apos;s nothing on page {page + 1}.{" "}
          <Link href={hrefWith("/requests", linkParams)} className={linkClass}>
            Go to the first page
          </Link>
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
            <span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatNumber(matched)}</span>{" "}
              {matched === 1 ? "request" : "requests"}
            </span>
            {vibe && (
              <Link href="/requests" className={linkClass}>
                Clear filters
              </Link>
            )}
            {matched > PAGE_SIZE && (
              <span>
                · showing {formatNumber(first)}–{formatNumber(last)}
              </span>
            )}
          </p>

          {requests.length ? (
            <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-surface px-4 shadow-sm dark:divide-zinc-800 dark:border-zinc-800">
              {requests.map((request) => {
                const isManual = request.model === MANUAL_MODEL;
                return (
                  <li key={request.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <ModelBadge model={request.model} />
                        <Badge>{vibeLabel(request.vibe)}</Badge>
                      </span>
                      <Link href={`/media/${request.id}`} className={`text-sm ${linkClass}`}>
                        Open photo<span className="sr-only"> #{request.id}</span> <span aria-hidden>→</span>
                      </Link>
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <When iso={request.created_at} show="ago" />
                      <span>
                        · by{" "}
                        <Link href={`/users/${request.user_id}`} className="hover:underline">
                          {displayName(request.author_name)}
                        </Link>
                      </span>
                      {request.location && <span>· 📍 {request.location}</span>}
                      <span className="tabular-nums">· {plural(request.captions?.length ?? 0, "caption")}</span>
                    </p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        {isManual ? "Saved prompts (no AI was called)" : "Exact prompts sent"}
                      </summary>
                      <Prompt
                        label="System prompt"
                        text={request.system_prompt}
                        empty="None: an admin wrote these captions by hand."
                      />
                      <Prompt label="Prompt (sent with the photo)" text={request.prompt} empty="None." />
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState>
              {vibe ? (
                <>
                  No requests with this vibe.{" "}
                  <Link href="/requests" className={linkClass}>
                    Show every request
                  </Link>
                </>
              ) : (
                "No requests yet. One is saved each time someone posts a photo in the main app."
              )}
            </EmptyState>
          )}

          <Pagination path="/requests" params={linkParams} page={page} pageSize={PAGE_SIZE} total={matched} />
        </>
      )}
    </>
  );
}
