import type { Metadata } from "next";
import { RecordForm, RecordItem, RecordList, type FieldSpec } from "@/components/records/record-editor";
import { Card, EmptyState, LoadError, PageHeader } from "@/components/ui";
import { When } from "@/components/users/when";
import { requireAdmin } from "@/lib/auth";
import { plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createTerm, deleteTerm, updateTerm } from "./actions";

export const metadata: Metadata = { title: "Terms" };

type Term = {
  id: number;
  term: string;
  definition: string;
  example: string | null;
  updated_at: string;
};

const FIELDS: FieldSpec[] = [
  { name: "term", label: "Term", required: true, maxLength: 60, placeholder: "Butler" },
  {
    name: "definition",
    label: "What it means",
    type: "textarea",
    required: true,
    maxLength: 500,
    hint: "Written for a model that has never been to Columbia.",
  },
  { name: "example", label: "Example", type: "textarea", maxLength: 300 },
];

// Insider lore: the Columbia and NYC words captions lean on. Humor is
// contextual, so the model needs to know what "Butler" or "Lit Hum" means.
export default async function TermsPage() {
  await requireAdmin("/terms");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("terms")
    .select("id, term, definition, example, updated_at")
    .order("term");
  const terms = (data ?? []) as Term[];

  return (
    <>
      <PageHeader
        title="Terms"
        description="Columbia and New York lore the captions can lean on, like Butler or Lit Hum. Not sent to the AI yet: the main app's prompts still name a few by hand."
      />
      {error ? (
        <LoadError what="terms" error={error} setupFile="supabase/week7.sql" />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card title={plural(terms.length, "term")}>
            {terms.length === 0 ? (
              <EmptyState>No terms yet. Add the first one.</EmptyState>
            ) : (
              <RecordList>
                {terms.map((term) => (
                  <RecordItem
                    key={term.id}
                    fields={FIELDS}
                    values={{ term: term.term, definition: term.definition, example: term.example ?? "" }}
                    updateAction={updateTerm.bind(null, term.id)}
                    deleteAction={deleteTerm.bind(null, term.id)}
                    deleteMessage={`Delete “${term.term}”? This can't be undone.`}
                  >
                    <p className="font-medium">{term.term}</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
                      {term.definition}
                    </p>
                    {term.example && (
                      <p className="mt-1 text-sm italic text-zinc-500 dark:text-zinc-400">“{term.example}”</p>
                    )}
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Updated <When iso={term.updated_at} show="ago" />
                    </p>
                  </RecordItem>
                ))}
              </RecordList>
            )}
          </Card>
          <Card title="Add a term" className="lg:sticky lg:top-8">
            <RecordForm
              fields={FIELDS}
              action={createTerm}
              submitLabel="Add term"
              pendingLabel="Adding…"
              clearOnSuccess
            />
          </Card>
        </div>
      )}
    </>
  );
}
