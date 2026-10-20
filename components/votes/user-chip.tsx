import Link from "next/link";

// "Voted by [Jane D. ✕]": the active ?user= filter, with a way to drop it.
export function UserChip({
  prefix,
  userId,
  name,
  clearHref,
  clearLabel,
}: {
  prefix: string;
  userId: string;
  name: string;
  clearHref: string;
  clearLabel: string;
}) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-zinc-500">{prefix}</span>
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 py-1 pl-3 pr-1 font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-200">
        <Link href={`/users/${userId}`} className="hover:underline">
          {name}
        </Link>
        <Link
          href={clearHref}
          aria-label={clearLabel}
          title="Remove this filter"
          className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-blue-200 dark:hover:bg-blue-900"
        >
          ✕
        </Link>
      </span>
    </p>
  );
}
