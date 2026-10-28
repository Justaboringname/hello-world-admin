import type { Metadata } from "next";
import { RecordForm, RecordItem, RecordList, type FieldSpec } from "@/components/records/record-editor";
import { Badge, Card, EmptyState, FilterTabs, LoadError, PageHeader, hrefWith } from "@/components/ui";
import { When } from "@/components/users/when";
import { requireAdmin } from "@/lib/auth";
import { parseId, plural } from "@/lib/format";
import { firstParam } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import { createExample, deleteExample, updateExample } from "./actions";

export const metadata: Metadata = { title: "Examples" };

type Chain = { id: number; name: string };

type Example = {
  id: number;
  chain_id: number | null;
  image_description: string;
  caption: string;
  notes: string | null;
  updated_at: string;
};

// The chain select lists the chains, so the fields are built per request.
function exampleFields(chains: Chain[]): FieldSpec[] {
  return [
    {
      name: "chain_id",
      label: "Chain",
      type: "select",
      options: chains.map((chain) => ({ value: String(chain.id), label: chain.name })),
      emptyOption: "Any chain",
    },
    {
      name: "image_description",
      label: "The photo",
      type: "textarea",
      required: true,
      maxLength: 300,
      hint: "Describe the photo the caption is for.",
    },
    { name: "caption", label: "Caption", type: "textarea", required: true, maxLength: 200 },
    { name: "notes", label: "Notes", type: "textarea", maxLength: 300 },
  ];
}

// Few-shot grounding: a photo, described in words, and a caption in one
// chain's voice. A few good captions show a voice better than describing it.
// Typed inline: PageProps<"/examples"> needs the route types regenerated.
export default async function ExamplesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/examples");
  const params = await searchParams;
  const supabase = await createClient();

  // Chains first: ?chain= only filters when it names one that exists.
  const chainsResult = await supabase.from("prompt_chains").select("id, name").order("id");
  const chains = (chainsResult.data ?? []) as Chain[];
  const chainId = parseId(firstParam(params.chain));
  const activeChain = chains.find((chain) => chain.id === chainId) ?? null;

  let query = supabase
    .from("ai_generation_examples")
    .select("id, chain_id, image_description, caption, notes, updated_at");
  if (activeChain) query = query.eq("chain_id", activeChain.id);
  const examplesResult = await query
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });
  const examples = (examplesResult.data ?? []) as Example[];

  const fields = exampleFields(chains);
  const chainNames = new Map(chains.map((chain) => [chain.id, chain.name]));
  const chainTabs = [
    { href: hrefWith("/examples", {}), label: "All", active: !activeChain },
    ...chains.map((chain) => ({
      href: hrefWith("/examples", { chain: chain.id }),
      label: chain.name,
      active: chain.id === activeChain?.id,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Examples"
        description="Example captions that show a chain's voice, meant as few-shot grounding. Not sent to the AI yet: the main app's prompts only describe each voice."
      />
      {chainsResult.error ? (
        <LoadError what="prompt chains" error={chainsResult.error} setupFile="supabase/week7.sql" />
      ) : examplesResult.error ? (
        <LoadError what="examples" error={examplesResult.error} setupFile="supabase/week7.sql" />
      ) : (
        <>
          {chains.length > 0 && (
            <div className="mb-5">
              <FilterTabs label="Which chain" items={chainTabs} />
            </div>
          )}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Card title={plural(examples.length, "example")}>
              {examples.length === 0 ? (
                <EmptyState>
                  {activeChain ? "No examples for this chain yet." : "No examples yet. Add the first one."}
                </EmptyState>
              ) : (
                <RecordList>
                  {examples.map((example) => (
                    <RecordItem
                      key={example.id}
                      fields={fields}
                      values={{
                        chain_id: example.chain_id ? String(example.chain_id) : "",
                        image_description: example.image_description,
                        caption: example.caption,
                        notes: example.notes ?? "",
                      }}
                      updateAction={updateExample.bind(null, example.id)}
                      deleteAction={deleteExample.bind(null, example.id)}
                      deleteMessage={`Delete the example “${example.caption}”? This can't be undone.`}
                    >
                      <p className="whitespace-pre-line font-medium">“{example.caption}”</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
                        <span aria-hidden>📷 </span>
                        {example.image_description}
                      </p>
                      {example.notes && (
                        <p className="mt-1 whitespace-pre-line text-sm text-zinc-500 dark:text-zinc-400">
                          {example.notes}
                        </p>
                      )}
                      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <Badge>
                          {example.chain_id ? (chainNames.get(example.chain_id) ?? "Unknown chain") : "Any chain"}
                        </Badge>
                        <span>
                          Updated <When iso={example.updated_at} show="ago" />
                        </span>
                      </p>
                    </RecordItem>
                  ))}
                </RecordList>
              )}
            </Card>
            <Card title="Add an example" className="lg:sticky lg:top-8">
              {/* Starts on the chain being viewed, so a new example shows up in
                  the list. Keyed by it: the tabs don't remount the page, and a
                  select only reads its default when it mounts. */}
              <RecordForm
                key={activeChain?.id ?? "all"}
                fields={fields}
                values={{ chain_id: activeChain ? String(activeChain.id) : "" }}
                action={createExample}
                submitLabel="Add example"
                pendingLabel="Adding…"
                clearOnSuccess
              />
            </Card>
          </div>
        </>
      )}
    </>
  );
}
