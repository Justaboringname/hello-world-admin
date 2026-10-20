import type { Metadata } from "next";
import Link from "next/link";
import { CreateMediaForm } from "@/components/media/create-media-form";
import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "New AI photo" };

// The Server Action on this page waits for Gemini (lib/gemini.ts gives up
// after 50 s), then uploads and saves.
export const maxDuration = 60;

export default async function NewMediaPage() {
  const admin = await requireAdmin("/media/new");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/media" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
        ← All AI media
      </Link>
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
