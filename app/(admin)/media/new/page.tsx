import type { Metadata } from "next";
import { CreateMediaForm } from "@/components/media/create-media-form";
import { BackLink, Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "New AI photo" };

// The Server Action on this page waits for Gemini (lib/gemini.ts gives up
// after 50 s), then uploads and saves.
export const maxDuration = 60;

export default async function NewMediaPage() {
  const admin = await requireAdmin("/media/new");

  return (
    <div className="max-w-2xl">
      <BackLink href="/media">All AI media</BackLink>
      <div className="mt-3">
        <PageHeader
          title="New AI photo"
          description={
            <>
              Posted as you, <span className="font-medium text-zinc-700 dark:text-zinc-300">{admin.name}</span>,
              and shown in the main app&apos;s feed like any other photo. The daily limit for users
              doesn&apos;t apply here.
            </>
          }
        />
      </div>
      <Card>
        <CreateMediaForm />
      </Card>
    </div>
  );
}
