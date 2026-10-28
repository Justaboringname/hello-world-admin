import type { Metadata } from "next";
import Link from "next/link";
import { RecordForm, RecordItem, RecordList, type FieldSpec } from "@/components/records/record-editor";
import { Badge, Card, EmptyState, LoadError, PageHeader, linkClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createModel, deleteModel, updateModel } from "./actions";

export const metadata: Metadata = { title: "LLM models" };

type Provider = { id: number; name: string };

type Model = {
  id: number;
  provider_id: number;
  name: string;
  api_model_id: string;
  supports_temperature: boolean;
  is_active: boolean;
  // Embedded: the provider through provider_id, and one entry per prompt
  // chain step whose model_id points here.
  llm_providers: { name: string } | null;
  prompt_chain_steps: { id: number }[] | null;
};

// The provider list comes from the database, so the fields are built per
// request.
function modelFields(providers: Provider[]): FieldSpec[] {
  return [
    {
      name: "provider_id",
      label: "Provider",
      type: "select",
      required: true,
      options: providers.map((provider) => ({ value: String(provider.id), label: provider.name })),
    },
    { name: "name", label: "Name", required: true, maxLength: 80, placeholder: "Gemini 3.5 Flash-Lite" },
    {
      name: "api_model_id",
      label: "API model id",
      required: true,
      maxLength: 100,
      hint: "What the API is called with, e.g. gemini-3.5-flash-lite",
    },
    {
      name: "supports_temperature",
      label: "Takes a temperature",
      type: "checkbox",
      hint: "Only non-reasoning models do.",
    },
    { name: "is_active", label: "Active", type: "checkbox" },
  ];
}

// "2 prompt chain steps use it and will be left without a model."
function deleteMessage(model: Model, steps: number) {
  const warning = steps
    ? ` ${plural(steps, "prompt chain step")} ${steps === 1 ? "uses" : "use"} it and will be left without a model.`
    : "";
  return `Delete “${model.name}”?${warning} This can't be undone.`;
}

// The models a prompt chain step can call, each under its provider.
export default async function LlmModelsPage() {
  await requireAdmin("/llm-models");
  const supabase = await createClient();
  const [modelsResult, providersResult] = await Promise.all([
    supabase
      .from("llm_models")
      .select(
        "id, provider_id, name, api_model_id, supports_temperature, is_active, llm_providers(name), prompt_chain_steps(id)",
      )
      .order("name"),
    supabase.from("llm_providers").select("id, name").order("name"),
  ]);
  const models = (modelsResult.data ?? []) as unknown as Model[];
  const providers = (providersResult.data ?? []) as Provider[];
  const fields = modelFields(providers);

  return (
    <>
      <PageHeader
        title="LLM models"
        description="The models a prompt chain step can call, and which steps use them. The main app still picks its Gemini models in code (lib/gemini.ts) and doesn't read this table yet."
      />
      {modelsResult.error ? (
        <LoadError what="LLM models" error={modelsResult.error} setupFile="supabase/week7.sql" />
      ) : providersResult.error ? (
        <LoadError what="providers" error={providersResult.error} setupFile="supabase/week7.sql" />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card title={plural(models.length, "model")}>
            {models.length === 0 ? (
              <EmptyState>No models yet. Add the first one.</EmptyState>
            ) : (
              <RecordList>
                {models.map((model) => {
                  const steps = model.prompt_chain_steps?.length ?? 0;
                  return (
                    <RecordItem
                      key={model.id}
                      fields={fields}
                      values={{
                        provider_id: String(model.provider_id),
                        name: model.name,
                        api_model_id: model.api_model_id,
                        supports_temperature: model.supports_temperature,
                        is_active: model.is_active,
                      }}
                      updateAction={updateModel.bind(null, model.id)}
                      deleteAction={deleteModel.bind(null, model.id)}
                      deleteMessage={deleteMessage(model, steps)}
                    >
                      <p className="font-medium">{model.name}</p>
                      <p className="mt-1 break-all font-mono text-sm text-zinc-700 dark:text-zinc-300">
                        {model.api_model_id}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {model.llm_providers && <Badge tone="violet">{model.llm_providers.name}</Badge>}
                        {model.is_active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
                        {model.supports_temperature && <Badge tone="blue">Takes a temperature</Badge>}
                      </div>
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {steps
                          ? `Used by ${plural(steps, "prompt chain step")}`
                          : "Not used by any prompt chain step"}
                      </p>
                    </RecordItem>
                  );
                })}
              </RecordList>
            )}
          </Card>
          <Card title="Add a model" className="lg:sticky lg:top-8">
            {providers.length === 0 ? (
              <EmptyState>
                Every model belongs to a provider, and there are none yet.{" "}
                <Link href="/llm-providers" className={linkClass}>
                  Add a provider first
                </Link>
              </EmptyState>
            ) : (
              <RecordForm
                fields={fields}
                values={{ is_active: true }}
                action={createModel}
                submitLabel="Add model"
                pendingLabel="Adding…"
                clearOnSuccess
              />
            )}
          </Card>
        </div>
      )}
    </>
  );
}
