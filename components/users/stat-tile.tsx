import Link from "next/link";
import { formatCompact, formatNumber } from "@/lib/format";

// One number on a user's page. Tiles with an href open the matching admin
// list, already filtered to this user.
export function StatTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number;
  hint?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <span className="block text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="mt-1 block text-3xl font-semibold tabular-nums" title={formatNumber(value)}>
        {formatCompact(value)}
      </span>
      {hint && <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>}
    </>
  );
  const className =
    "block h-full rounded-2xl border border-zinc-200 bg-surface p-4 shadow-sm dark:border-zinc-800";

  return href ? (
    <Link
      href={href}
      className={`${className} transition hover:border-zinc-300 hover:shadow-md dark:hover:border-zinc-700`}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
