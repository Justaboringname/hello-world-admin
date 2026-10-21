"use client";

import { useEffect } from "react";

// Anything a page didn't handle itself (Supabase down, a bug). The sidebar
// stays, so the admin can move on to another section.
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-4xl" aria-hidden>
        🫠
      </p>
      <h1 className="mt-3 text-xl font-semibold">Something went wrong</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        The page couldn&apos;t load. It may be a hiccup on Supabase&apos;s side.
        {error.digest && <span className="block font-mono text-xs">Error {error.digest}</span>}
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-5 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Try again
      </button>
    </div>
  );
}
