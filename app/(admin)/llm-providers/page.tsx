import type { Metadata } from "next";
import { RecordForm, RecordItem, RecordList, type FieldSpec } from "@/components/records/record-editor";
import { Card, EmptyState, LoadError, PageHeader, linkClass } from "@/components/ui";
import { When } from "@/components/users/when";
import { requireAdmin } from "@/lib/auth";
import { plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createProvider, deleteProvider, updateProvider } from "./actions";

export const metadata: Metadata = { title: "LLM providers" };

type Provider = {
  id: number;
  name: string;
  website: string | null;
  created_at: string;
  // Embedded through llm_models.provider_id: one entry per model.
  llm_models: { id: number }[] | null;
};

const FIELDS: FieldSpec[] = [
  { name: "name", label: "Name", required: true, maxLength: 60, placeholder: "Google" },
  {
    name: "website",
    label: "Website",
    type: "url",
    maxLength: 200,
    placeholder: "https://ai.google.dev",
    hint: "Must start with https://.",
  },
];

// The companies whose models we call. Every LLM model belongs to one, and a
// provider can't be deleted while it still has models.
export default async function LlmProvidersPage() {
  await requireAdmin("/llm-providers");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("llm_providers")
    .select("id, name, website, created_at, llm_models(id)")
    .order("name");
  const providers = (data ?? []) as unknown as Provider[];

  return (
    <>
      <PageHeader
        title="LLM providers"
        description="The companies whose models we call. Every LLM model belongs to one. The main app doesn't read this table yet: it calls Claude, then Gemini when Claude can't answer, with models picked in its code."
      />
      {error ? (
        <LoadError what="providers" error={error} setupFile="supabase/week7.sql" />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card title={plural(providers.length, "provider")}>
            {providers.length === 0 ? (
              <EmptyState>No providers yet. Add the first one.</EmptyState>
            ) : (
              <RecordList>
                {providers.map((provider) => {
                  const models = provider.llm_models?.length ?? 0;
                  return (
                    <RecordItem
                      key={provider.id}
                      fields={FIELDS}
                      values={{ name: provider.name, website: provider.website ?? "" }}
                      updateAction={updateProvider.bind(null, provider.id)}
                      deleteAction={deleteProvider.bind(null, provider.id)}
                      deleteMessage={`Delete “${provider.name}”? This can't be undone.`}
                    >
                      <p className="font-medium">{provider.name}</p>
                      {provider.website && (
                        <p className="mt-1 break-words text-sm">
                          <a href={provider.website} target="_blank" rel="noreferrer" className={linkClass}>
                            {provider.website} ↗
                          </a>
                        </p>
                      )}
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {plural(models, "model")} · Added <When iso={provider.created_at} show="date" />
                      </p>
                    </RecordItem>
                  );
                })}
              </RecordList>
            )}
          </Card>
          <Card title="Add a provider" className="lg:sticky lg:top-8">
            <RecordForm
              fields={FIELDS}
              action={createProvider}
              submitLabel="Add provider"
              pendingLabel="Adding…"
              clearOnSuccess
            />
          </Card>
        </div>
      )}
    </>
  );
}
