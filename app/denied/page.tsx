import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { Logo } from "@/components/logo";
import { SubmitButton } from "@/components/submit-button";
import { checkAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Not an admin" };

// Signed in with Google, but profiles.is_superadmin isn't true for this
// account. Offer a way to switch accounts and nothing else.
export default async function DeniedPage() {
  const check = await checkAdmin();
  if (check.status === "signed-out") redirect("/login");
  if (check.status === "admin") redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-surface p-8 text-center shadow-sm dark:border-zinc-800">
        <Logo className="mx-auto mb-4 h-12 w-12" />
        <h1 className="text-2xl font-semibold tracking-tight">This account isn&apos;t an admin</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {check.email ? (
            <>
              You&apos;re signed in as <span className="font-medium text-zinc-700 dark:text-zinc-300">{check.email}</span>.
            </>
          ) : (
            "You're signed in."
          )}{" "}
          Only superadmins can open the admin panel.
        </p>

        {check.setupNeeded && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-left text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            The database isn&apos;t set up for the admin panel yet. Run{" "}
            <code className="font-mono text-xs">supabase/admin.sql</code> in the Supabase SQL Editor.
          </p>
        )}

        <form action={signOut} className="mt-6">
          <SubmitButton
            pendingLabel="Signing out…"
            className="w-full bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Sign in with a different account
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
