import type { Metadata } from "next";
import Link from "next/link";
import { MixEditor, type MixRow } from "@/components/prompt-chains/mix-editor";
import { Badge, Card, Detail, EmptyState, LoadError, PageHeader, hrefWith, linkClass } from "@/components/ui";
import { When } from "@/components/users/when";
import { requireAdmin } from "@/lib/auth";
import { MANUAL_MODEL } from "@/lib/captions";
import { plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Prompt chains" };

type Chain = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
};

// The model comes through model_id as one object (many-to-one), or null once
// that model is deleted. The untyped client guesses a list, so rows are cast
// through unknown.
type Step = {
  id: number;
  chain_id: number;
  step_order: number;
  name: string;
  model_id: number | null;
  temperature: number | null; // null: the model's default
  system_prompt: string;
  user_prompt: string;
  output_format: string | null;
  model: { name: string; api_model_id: string } | null;
};

type Mix = { chain_id: number; weight: number; updated_at: string };

const STEP_COLUMNS =
  "id, chain_id, step_order, name, model_id, temperature, system_prompt, user_prompt, output_format, model:llm_models(name, api_model_id)";

// The two lines {location_line} becomes, from lib/gemini.ts.
const LOCATION_GIVEN = "The poster says it was taken at: \"<location>\".";
const LOCATION_MISSING = "The poster didn't say where in New York it was taken.";

function PromptText({ label, text }: { label: string; text: string }) {
  return (
    <details className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{label}</summary>
      <pre className="mx-3 mb-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-900">
        {text}
      </pre>
    </details>
  );
}

// One chain per vibe, the requests it makes in order, and how often each
// should be picked. Chains and steps change through supabase/week7.sql, not
// here; the mix weights are the only thing this page saves.
export default async function PromptChainsPage() {
  await requireAdmin("/prompt-chains");
  const supabase = await createClient();

  const [chainsResult, stepsResult, mixResult] = await Promise.all([
    supabase.from("prompt_chains").select("id, slug, name, description").order("id"),
    supabase.from("prompt_chain_steps").select(STEP_COLUMNS).order("chain_id").order("step_order"),
    supabase.from("prompt_chain_mix").select("chain_id, weight, updated_at"),
  ]);
  const chains = (chainsResult.data ?? []) as Chain[];
  const steps = (stepsResult.data ?? []) as unknown as Step[];
  const mix = (mixResult.data ?? []) as Mix[];

  // Photos whose vibe is the chain's slug, one count per chain. Captions an
  // admin wrote by hand weren't written by the chain, so they don't count.
  // HEAD requests carry no error body, so a missing count is the failure.
  const counts = await Promise.all(
    chains.map((chain) =>
      supabase
        .from("generations")
        .select("id", { count: "exact", head: true })
        .eq("vibe", chain.slug)
        .neq("model", MANUAL_MODEL)
        .then(({ count }) => count),
    ),
  );

  const mixByChain = new Map(mix.map((row) => [row.chain_id, row]));
  // Only chains with a mix row: the panel can change a weight, not add one.
  const mixRows: MixRow[] = chains.flatMap((chain) => {
    const row = mixByChain.get(chain.id);
    return row ? [{ chainId: chain.id, name: chain.name, weight: row.weight }] : [];
  });
  const notInMix = chains.filter((chain) => !mixByChain.has(chain.id));
  const lastChanged = mix.reduce<string | null>(
    (latest, row) => (!latest || Date.parse(row.updated_at) > Date.parse(latest) ? row.updated_at : latest),
    null,
  );

  return (
    <>
      <PageHeader
        title="Prompt chains"
        description="The prompts behind each vibe, step by step, and how often each one should be picked. Read only, except the mix."
      />
      {chainsResult.error ? (
        <LoadError what="prompt chains" error={chainsResult.error} setupFile="supabase/week7.sql" />
      ) : chains.length === 0 ? (
        <EmptyState>No prompt chains yet. Running supabase/week7.sql adds one for each vibe.</EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <p>
              These chains are seeded from the main app&apos;s <code className="font-mono">lib/gemini.ts</code>.
              The main app still runs those prompts from code and doesn&apos;t read these tables yet, and
              neither does <code className="font-mono">/media/new</code> here. Each chain is one step today:
              one Gemini call that sees the photo and returns three captions.
            </p>
            <p>
              In a user prompt, <code className="font-mono">{"{location_line}"}</code> is filled in for each
              photo with where it was taken: <q>{LOCATION_GIVEN}</q>, or <q>{LOCATION_MISSING}</q>
            </p>
          </div>

          <Card
            title="Mix"
            description={
              <>
                How often each chain should be picked. Nothing reads this yet: people pick the vibe
                themselves when they post.
                {!mixResult.error && (
                  <>
                    {" "}
                    Last changed <When iso={lastChanged} show="ago" never="never" />.
                  </>
                )}
              </>
            }
          >
            {mixResult.error ? (
              <LoadError what="the mix" error={mixResult.error} setupFile="supabase/week7.sql" />
            ) : mixRows.length === 0 ? (
              <EmptyState>No chains are in the mix yet. Running supabase/week7.sql adds them.</EmptyState>
            ) : (
              <MixEditor rows={mixRows} />
            )}
            {!mixResult.error && notInMix.length > 0 && mixRows.length > 0 && (
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                Not in the mix: {notInMix.map((chain) => chain.name).join(", ")}. Only supabase/week7.sql
                can add a chain to it.
              </p>
            )}
          </Card>

          {stepsResult.error && <LoadError what="the steps" error={stepsResult.error} setupFile="supabase/week7.sql" />}

          {chains.map((chain, index) => {
            const count = counts[index];
            const chainSteps = steps.filter((step) => step.chain_id === chain.id);
            return (
              <Card
                key={chain.id}
                title={chain.name}
                description={chain.description}
                actions={
                  <Badge>
                    <span className="font-mono">{chain.slug}</span>
                  </Badge>
                }
              >
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                  <span>{count === null ? "Couldn't count its photos" : `${plural(count, "photo")} captioned`}</span>
                  <span aria-hidden>·</span>
                  <Link href={hrefWith("/requests", { vibe: chain.slug })} className={linkClass}>
                    See its requests
                  </Link>
                </p>

                {!stepsResult.error && (
                  <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                    {chainSteps.length === 0 ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">No steps yet.</p>
                    ) : (
                      <ol className="space-y-6">
                        {chainSteps.map((step) => (
                          <li key={step.id}>
                            <h3 className="text-sm font-semibold">
                              <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                                Step {step.step_order}
                              </span>{" "}
                              · {step.name}
                            </h3>
                            <dl className="mt-1 divide-y divide-zinc-200 dark:divide-zinc-800">
                              <Detail label="Model">
                                {step.model ? (
                                  <>
                                    {step.model.name}{" "}
                                    <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                      {step.model.api_model_id}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-zinc-500 dark:text-zinc-400">No model</span>
                                )}
                              </Detail>
                              <Detail label="Temperature">
                                {step.temperature === null ? (
                                  <span className="text-zinc-500 dark:text-zinc-400">Model default</span>
                                ) : (
                                  <span className="tabular-nums">{step.temperature}</span>
                                )}
                              </Detail>
                              <Detail label="Output">
                                {step.output_format ?? (
                                  <span className="text-zinc-500 dark:text-zinc-400">Not set</span>
                                )}
                              </Detail>
                            </dl>
                            <div className="mt-3 space-y-2">
                              <PromptText label="System prompt" text={step.system_prompt} />
                              <PromptText label="User prompt" text={step.user_prompt} />
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
