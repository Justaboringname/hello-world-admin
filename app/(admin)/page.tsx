import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { ErrorNote, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await requireAdmin("/");
  const { dashboard, error } = await getDashboard();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="What people post, what they vote for, and when campus laughs. Updated on every visit."
      />
      {error ? (
        <ErrorNote>
          {/* PGRST202: PostgREST can't find the function, so admin.sql hasn't been run. */}
          {error.code === "PGRST202"
            ? "The admin_dashboard() function isn't in the database yet. Run admin/supabase/admin.sql in the Supabase SQL Editor, then reload this page."
            : `Couldn't load the statistics: ${error.message}`}
        </ErrorNote>
      ) : dashboard ? (
        <DashboardView dashboard={dashboard} />
      ) : (
        <ErrorNote>The database sent back no statistics. Try reloading the page.</ErrorNote>
      )}
    </>
  );
}
