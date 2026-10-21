import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { AdminNav } from "@/components/admin-nav";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/logo";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth";

// The shell around every admin page. It checks too, so the sidebar never
// renders for anyone else, but each page and Server Action still calls
// requireAdmin() itself: layouts don't re-run on client navigation.
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen font-sans lg:flex">
      <a
        href="#content"
        className="sr-only z-50 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3 dark:bg-white dark:text-zinc-900"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r dark:border-zinc-800/80 dark:bg-zinc-950/85">
        <div className="flex h-full flex-col gap-3 px-3 py-3 lg:gap-6 lg:py-5">
          <div className="flex items-center justify-between gap-2 px-1">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Logo />
              <span>Hello World</span>
              <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                Admin
              </span>
            </Link>
            <form action={signOut} className="lg:hidden">
              <SubmitButton
                pendingLabel="…"
                className="px-3 py-1.5 text-zinc-600 hover:bg-zinc-900/[0.05] dark:text-zinc-400 dark:hover:bg-white/5"
              >
                Sign out
              </SubmitButton>
            </form>
          </div>

          <AdminNav />

          <div className="mt-auto hidden border-t border-zinc-200 pt-4 lg:block dark:border-zinc-800">
            <div className="flex items-center gap-2.5 px-1">
              <Avatar src={admin.avatarUrl} name={admin.name} decorative />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{admin.name}</p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{admin.email}</p>
              </div>
            </div>
            <form action={signOut} className="mt-3">
              <SubmitButton
                pendingLabel="Signing out…"
                className="w-full px-3 py-1.5 text-left text-zinc-600 hover:bg-zinc-900/[0.05] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                Sign out
              </SubmitButton>
            </form>
          </div>
        </div>
      </aside>

      <main id="content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {children}
      </main>
    </div>
  );
}
