import type { Metadata } from "next";
import { RecordForm, RecordItem, RecordList, type FieldSpec } from "@/components/records/record-editor";
import { Badge, Card, EmptyState, LoadError, PageHeader } from "@/components/ui";
import { When } from "@/components/users/when";
import { requireAdmin } from "@/lib/auth";
import { plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createDomain, createEmail, deleteDomain, deleteEmail, updateDomain, updateEmail } from "./actions";

export const metadata: Metadata = { title: "Sign-up rules" };

type Domain = {
  id: number;
  domain: string;
  note: string | null;
  created_at: string;
};

type Email = {
  id: number;
  email: string;
  note: string | null;
  created_at: string;
};

const NOTE_FIELD: FieldSpec = { name: "note", label: "Note", maxLength: 200, placeholder: "Who this is for" };

const DOMAIN_FIELDS: FieldSpec[] = [
  {
    name: "domain",
    label: "Domain",
    required: true,
    maxLength: 253,
    placeholder: "columbia.edu",
    hint: "The part after the @.",
  },
  NOTE_FIELD,
];

const EMAIL_FIELDS: FieldSpec[] = [
  {
    name: "email",
    label: "Email address",
    type: "email",
    required: true,
    maxLength: 254,
    placeholder: "name@example.com",
  },
  NOTE_FIELD,
];

// Who should be able to sign up: anyone at an allowed domain, plus single
// addresses from anywhere. Nothing reads these lists yet, so the page says so.
export default async function AccessPage() {
  await requireAdmin("/access");
  const supabase = await createClient();
  const [domainResult, emailResult] = await Promise.all([
    supabase.from("allowed_signup_domains").select("id, domain, note, created_at").order("domain"),
    supabase.from("whitelisted_email_addresses").select("id, email, note, created_at").order("email"),
  ]);
  const domains = (domainResult.data ?? []) as Domain[];
  const emails = (emailResult.data ?? []) as Email[];

  return (
    <>
      <PageHeader
        title="Sign-up rules"
        description="Who should be allowed to sign up: anyone with an email at an allowed domain, plus single whitelisted addresses from any domain. Sign-in doesn't check these lists yet: today anyone with a Google account can sign in to the main app."
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card
          title="Allowed sign-up domains"
          description="For anyone with an email address at one of these."
          actions={!domainResult.error && <Badge>{plural(domains.length, "domain")}</Badge>}
        >
          {domainResult.error ? (
            <LoadError what="sign-up domains" error={domainResult.error} setupFile="supabase/week7.sql" />
          ) : (
            <>
              {domains.length === 0 ? (
                <EmptyState>No domains yet. Add the first one below.</EmptyState>
              ) : (
                <RecordList>
                  {domains.map((domain) => (
                    <RecordItem
                      key={domain.id}
                      fields={DOMAIN_FIELDS}
                      values={{ domain: domain.domain, note: domain.note ?? "" }}
                      updateAction={updateDomain.bind(null, domain.id)}
                      deleteAction={deleteDomain.bind(null, domain.id)}
                      deleteMessage={`Delete “${domain.domain}”? This can't be undone.`}
                    >
                      <p className="break-words font-medium">{domain.domain}</p>
                      {domain.note && <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{domain.note}</p>}
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Added <When iso={domain.created_at} show="ago" />
                      </p>
                    </RecordItem>
                  ))}
                </RecordList>
              )}
              <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                <h3 className="mb-3 text-sm font-medium">Add a domain</h3>
                <RecordForm
                  fields={DOMAIN_FIELDS}
                  action={createDomain}
                  submitLabel="Add domain"
                  pendingLabel="Adding…"
                  clearOnSuccess
                />
              </div>
            </>
          )}
        </Card>

        <Card
          title="Whitelisted email addresses"
          description="Single addresses, from any domain."
          actions={!emailResult.error && <Badge>{plural(emails.length, "address", "addresses")}</Badge>}
        >
          {emailResult.error ? (
            <LoadError what="whitelisted addresses" error={emailResult.error} setupFile="supabase/week7.sql" />
          ) : (
            <>
              {emails.length === 0 ? (
                <EmptyState>No addresses yet. Add the first one below.</EmptyState>
              ) : (
                <RecordList>
                  {emails.map((email) => (
                    <RecordItem
                      key={email.id}
                      fields={EMAIL_FIELDS}
                      values={{ email: email.email, note: email.note ?? "" }}
                      updateAction={updateEmail.bind(null, email.id)}
                      deleteAction={deleteEmail.bind(null, email.id)}
                      deleteMessage={`Delete “${email.email}”? This can't be undone.`}
                    >
                      <p className="break-words font-medium">{email.email}</p>
                      {email.note && <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{email.note}</p>}
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Added <When iso={email.created_at} show="ago" />
                      </p>
                    </RecordItem>
                  ))}
                </RecordList>
              )}
              <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                <h3 className="mb-3 text-sm font-medium">Add an address</h3>
                <RecordForm
                  fields={EMAIL_FIELDS}
                  action={createEmail}
                  submitLabel="Add address"
                  pendingLabel="Adding…"
                  clearOnSuccess
                />
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
