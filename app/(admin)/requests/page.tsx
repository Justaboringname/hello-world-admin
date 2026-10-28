import type { Metadata } from "next";
import Link from "next/link";
import type { MediaDetail } from "@/components/media/data";
import { Badge, EmptyState, FilterTabs, LoadError, PageHeader, Pagination, hrefWith, linkClass } from "@/components/ui";
import { When } from "@/components/users/when";
import { VoteTally } from "@/components/vote-tally";
import { requireAdmin } from "@/lib/auth";
import { MANUAL_MODEL, VIBES, isVibe, vibeLabel, type Vibe } from "@/lib/captions";
import { displayName, formatNumber, pageIndex, scoreTone, signedScore } from "@/lib/format";
import { firstParam } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Requests & responses" };

const PAGE_SIZE = 25;

// A photo row as one LLM call: the request (who asked, the vibe, the exact
// prompts, the model) and the response (the captions that came back).
type CallRow = Omit<MediaDetail, "image_path">;

const CALL_COLUMNS =
  "id, user_id, author_name, location, vibe, system_prompt, prompt, model, created_at, captions(id, position, text, upvotes, downvotes, score)";

const PAGE_DESCRIPTION =
  "Each photo posted for AI captions is one request and its response: who asked, the exact prompts, the model that answered (Claude Opus 5.5, or Gemini when Claude couldn't), and the captions that came back with their votes. Only requests that worked are saved: failed calls aren't logged yet, here or in the main app. Admins can reword, add or delete captions on a photo's page, so these are the captions as they are now.";

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

// Every photo in generations is one call: its prompts, model and time are
// saved with it, and its captions are the answer. Nothing else is logged yet.
export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  await requireAdmin("/requests");
  const params = await searchParams;
  const vibeParam = firstParam(params.vibe);
  const vibe: Vibe | undefined = isVibe(vibeParam) ? vibeParam : undefined;
  const page = pageIndex(firstParam(params.page));

  const supabase = await createClient();

  // The model tabs: every model that has answered. PostgREST has no DISTINCT,
  // so this reads each photo's model (up to the server's row cap, 1,000 by
  // default, newest first) and dedupes. Plenty at class size.
  const modelRows = await supabase.from("generations").select("model").order("created_at", { ascending: false });
  if (modelRows.error) {
    return (
      <>
        <PageHeader title="Requests & responses" description={PAGE_DESCRIPTION} />
        <LoadError what="models" error={modelRows.error} />
      </>
    );
  }
  const models = [...new Set(((modelRows.data ?? []) as { model: string }[]).map((row) => row.model))].sort();
  // Only a model from the list filters, so anything else in the URL is ignored.
  const modelParam = firstParam(params.model);
  const model = modelParam && models.includes(modelParam) ? modelParam : undefined;

  let query = supabase.from("generations").select(CALL_COLUMNS, { count: "exact" });
  if (vibe) query = query.eq("vibe", vibe);
  if (model) query = query.eq("model", model);
  // The unique id keeps requests made in the same instant from swapping pages.
  const result = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const calls = (result.data ?? []) as CallRow[];
  const matched = result.count ?? calls.length;
  // PGRST103: a ?page= past the last page.
  const pastEnd = result.error?.code === "PGRST103" || (!result.error && !calls.length && page > 0);
  const error = pastEnd ? null : result.error;

  // Each row of tabs keeps the other filter.
  const linkParams = { vibe, model };
  const vibeTabs = [
    { href: hrefWith("/requests", { model }), label: "All vibes", active: !vibe },
    ...(Object.keys(VIBES) as Vibe[]).map((key) => ({
      href: hrefWith("/requests", { vibe: key, model }),
      label: vibeLabel(key),
      active: key === vibe,
    })),
  ];
  const modelTabs = [
    { href: hrefWith("/requests", { vibe }), label: "All models", active: !model },
    ...models.map((key) => ({
      href: hrefWith("/requests", { vibe, model: key }),
      label: key === MANUAL_MODEL ? "✍️ Written by hand" : <span className="font-mono">{key}</span>,
      active: key === model,
    })),
  ];
  const first = page * PAGE_SIZE + 1;
  const last = page * PAGE_SIZE + calls.length;

  return (
    <>
      <PageHeader title="Requests & responses" description={PAGE_DESCRIPTION} />

      <div className="mb-5 space-y-2">
        <FilterTabs label="Filter by vibe" items={vibeTabs} />
        <FilterTabs label="Filter by model" items={modelTabs} />
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
            {(vibe || model) && (
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

          {calls.length ? (
            <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-surface px-4 shadow-sm dark:divide-zinc-800 dark:border-zinc-800">
              {calls.map((call) => {
                const isManual = call.model === MANUAL_MODEL;
                const captions = [...(call.captions ?? [])].sort((a, b) => a.position - b.position);
                return (
                  <li key={call.id} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <ModelBadge model={call.model} />
                        <Badge>{vibeLabel(call.vibe)}</Badge>
                      </span>
                      <Link href={`/media/${call.id}`} className={`text-sm ${linkClass}`}>
                        Open photo<span className="sr-only"> #{call.id}</span> <span aria-hidden>→</span>
                      </Link>
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <When iso={call.created_at} show="ago" />
                      <span>
                        · by{" "}
                        <Link href={`/users/${call.user_id}`} className="hover:underline">
                          {displayName(call.author_name)}
                        </Link>
                      </span>
                      {call.location && <span>· 📍 {call.location}</span>}
                    </p>

                    {captions.length ? (
                      // Numbered by position, so a gap shows a caption was deleted.
                      <ol className="mt-2 list-decimal space-y-1.5 pl-6 text-sm marker:text-zinc-500 dark:marker:text-zinc-400">
                        {captions.map((caption) => (
                          <li key={caption.id} value={caption.position}>
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                              <span className="min-w-0 break-words">“{caption.text}”</span>
                              <span className="flex shrink-0 items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                                <VoteTally upvotes={caption.upvotes} downvotes={caption.downvotes} />
                                <Badge tone={scoreTone(caption.score)}>
                                  <span className="sr-only">Score </span>
                                  {signedScore(caption.score)}
                                </Badge>
                              </span>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-2 text-sm italic text-zinc-500 dark:text-zinc-400">No captions.</p>
                    )}

                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        {isManual ? "Saved prompts (no AI was called)" : "Exact prompts sent"}
                      </summary>
                      <Prompt
                        label="System prompt"
                        text={call.system_prompt}
                        empty="None: an admin wrote these captions by hand."
                      />
                      <Prompt label="Prompt (sent with the photo)" text={call.prompt} empty="None." />
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState>
              {vibe || model ? (
                <>
                  No requests match these filters.{" "}
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
