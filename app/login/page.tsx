import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/app/auth/actions";
import { Logo } from "@/components/logo";
import { SubmitButton } from "@/components/submit-button";
import { checkAdmin } from "@/lib/auth";
import { firstParam, safeNextPath } from "@/lib/redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(firstParam(params.next));
  const error = firstParam(params.error);

  const check = await checkAdmin();
  if (check.status === "admin") redirect(next);
  if (check.status === "not-admin") redirect("/denied");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 font-sans">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-surface p-8 text-center shadow-sm dark:border-zinc-800">
        <Logo className="mx-auto mb-4 h-12 w-12" />
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
          Admin panel
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Superadmins only. Use the Google account you sign in to the app with.
        </p>

        <form action={signInWithGoogle} className="mt-6">
          <input type="hidden" name="next" value={next} />
          <SubmitButton
            pendingLabel="Redirecting to Google…"
            className="flex w-full items-center justify-center gap-3 border border-zinc-300 bg-white px-5 py-2.5 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <GoogleIcon />
            Continue with Google
          </SubmitButton>
        </form>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            Sign-in failed: {error}
          </p>
        )}
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="h-5 w-5">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
