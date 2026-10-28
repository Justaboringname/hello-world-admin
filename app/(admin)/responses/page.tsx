import type { Metadata } from "next";
import Link from "next/link";
import type { MediaDetail } from "@/components/media/data";
import { Badge, EmptyState, FilterTabs, LoadError, PageHeader, Pagination, hrefWith, linkClass } from "@/components/ui";
import { When } from "@/components/users/when";
import { VoteTally } from "@/components/vote-tally";
import { requireAdmin } from "@/lib/auth";
import { MANUAL_MODEL, vibeLabel } from "@/lib/captions";
import { formatNumber, pageIndex, scoreTone, signedScore } from "@/lib/format";
import { firstParam } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "LLM responses" };

// Requests per page, each with its captions.
const PAGE_SIZE = 25;

type ResponseRow = Pick<MediaDetail, "id" | "vibe" | "model" | "created_at" | "captions">;

const RESPONSE_COLUMNS = "id, vibe, model, created_at, captions(id, position, text, upvotes, downvotes, score)";

const PAGE_DESCRIPTION =
  "What came back for each request: its captions in order, with their votes. Admins can reword, add or delete captions on a photo's page, so these are the captions as they are now.";

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

// One response per photo in generations: the captions saved with it.
export default async function ResponsesPage({ searchParams }: PageProps<"/responses">) {
  await requireAdmin("/responses");
  const params = await searchParams;
  const page = pageIndex(firstParam(params.page));

  const supabase = await createClient();

  // The filter tabs: every model that has answered. PostgREST has no DISTINCT,
  // so this reads each photo's model (up to the server's row cap, 1,000 by
  // default, newest first) and dedupes. Plenty at class size.
  const modelRows = await supabase.from("generations").select("model").order("created_at", { ascending: false });
  if (modelRows.error) {
    return (
      <>
        <PageHeader title="LLM responses" description={PAGE_DESCRIPTION} />
        <LoadError what="models" error={modelRows.error} />
      </>
    );
  }
  const models = [...new Set(((modelRows.data ?? []) as { model: string }[]).map((row) => row.model))].sort();
  // Only a model from the list filters, so anything else in the URL is ignored.
  const modelParam = firstParam(params.model);
  const model = modelParam && models.includes(modelParam) ? modelParam : undefined;

  let query = supabase.from("generations").select(RESPONSE_COLUMNS, { count: "exact" });
  if (model) query = query.eq("model", model);
  // The unique id keeps requests made in the same instant from swapping pages.
  const result = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const responses = (result.data ?? []) as ResponseRow[];
  const matched = result.count ?? responses.length;
  // PGRST103: a ?page= past the last page.
  const pastEnd = result.error?.code === "PGRST103" || (!result.error && !responses.length && page > 0);
  const error = pastEnd ? null : result.error;

  const linkParams = { model };
  const modelTabs = [
    { href: "/responses", label: "All models", active: !model },
    ...models.map((key) => ({
      href: hrefWith("/responses", { model: key }),
      label: key === MANUAL_MODEL ? "✍️ Written by hand" : <span className="font-mono">{key}</span>,
      active: key === model,
    })),
  ];
  const first = page * PAGE_SIZE + 1;
  const last = page * PAGE_SIZE + responses.length;

  return (
    <>
      <PageHeader title="LLM responses" description={PAGE_DESCRIPTION} />

      <div className="mb-5">
        <FilterTabs label="Filter by model" items={modelTabs} />
      </div>

      {error ? (
        <LoadError what="responses" error={error} />
      ) : pastEnd ? (
        <EmptyState>
          There&apos;s nothing on page {page + 1}.{" "}
          <Link href={hrefWith("/responses", linkParams)} className={linkClass}>
            Go to the first page
          </Link>
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
            <span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatNumber(matched)}</span>{" "}
              {matched === 1 ? "response" : "responses"}
            </span>
            {model && (
              <Link href="/responses" className={linkClass}>
                Clear filters
              </Link>
            )}
            {matched > PAGE_SIZE && (
              <span>
                · showing {formatNumber(first)}–{formatNumber(last)}
              </span>
            )}
          </p>

          {responses.length ? (
            <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-surface px-4 shadow-sm dark:divide-zinc-800 dark:border-zinc-800">
              {responses.map((response) => {
                const captions = [...(response.captions ?? [])].sort((a, b) => a.position - b.position);
                return (
                  <li key={response.id} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <ModelBadge model={response.model} />
                        <Badge>{vibeLabel(response.vibe)}</Badge>
                        <When iso={response.created_at} show="ago" />
                      </span>
                      <Link href={`/media/${response.id}`} className={`text-sm ${linkClass}`}>
                        Open photo<span className="sr-only"> #{response.id}</span> <span aria-hidden>→</span>
                      </Link>
                    </div>
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
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState>
              {model ? (
                <>
                  No responses from this model.{" "}
                  <Link href="/responses" className={linkClass}>
                    Show every response
                  </Link>
                </>
              ) : (
                "No responses yet. They show up here once someone posts a photo in the main app."
              )}
            </EmptyState>
          )}

          <Pagination path="/responses" params={linkParams} page={page} pageSize={PAGE_SIZE} total={matched} />
        </>
      )}
    </>
  );
}
