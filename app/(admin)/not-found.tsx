import Link from "next/link";

// A bad id (/media/999999, /users/not-a-uuid) or a row someone just deleted.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-4xl" aria-hidden>
        🔎
      </p>
      <h1 className="mt-3 text-xl font-semibold">Not found</h1>
      <p className="mt-1 text-sm text-zinc-500">
        It may have been deleted, or the link is wrong.
      </p>
      <Link
        href="/"
        className="mt-5 inline-block rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Back to the dashboard
      </Link>
    </div>
  );
}
