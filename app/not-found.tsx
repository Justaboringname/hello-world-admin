import Link from "next/link";
import { Logo } from "@/components/logo";

// A URL that matches no admin route. proxy.ts sends everyone else to sign in
// first, so in practice only superadmins see it; it shows no data anyway.
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 font-sans">
      <div className="text-center">
        <Logo className="mx-auto mb-4 h-12 w-12" />
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">There&apos;s no admin page at this address.</p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Back to the dashboard
        </Link>
      </div>
    </main>
  );
}
