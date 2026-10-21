import Link from "next/link";
import type { Dashboard } from "@/lib/dashboard";
import { formatNumber } from "@/lib/format";
import { decimal, formatWait, percent, share } from "./numbers";

type Fact = {
  icon: string;
  value: string;
  label: React.ReactNode;
  link?: { href: string; label: string };
};

// The small numbers that say whether the app is healthy: do new posts get
// seen, is anything sitting ignored, who's taking part.
export function HealthFacts({
  totals,
  firstVoteMinutes,
}: {
  totals: Dashboard["totals"];
  firstVoteMinutes: number | null;
}) {
  const perPhoto = share(totals.captions, totals.photos);
  const facts: Fact[] = [
    {
      icon: "⏱️",
      value: formatWait(firstVoteMinutes),
      label: "median wait for a new post's first vote",
    },
    {
      icon: "🫥",
      value: formatNumber(totals.unvoted_posts),
      label: `${totals.unvoted_posts === 1 ? "post" : "posts"} (photos and memes) with no votes yet`,
      link: totals.unvoted_posts > 0 ? { href: "/media?sort=unvoted", label: "See unvoted photos →" } : undefined,
    },
    {
      icon: "✍️",
      value: formatNumber(totals.captions),
      label: perPhoto === null ? "captions written" : `captions written, ${decimal(perPhoto)} per photo`,
    },
    {
      icon: "🗳️",
      value: formatNumber(totals.voters),
      label: `${totals.voters === 1 ? "person has" : "people have"} voted, ${percent(share(totals.voters, totals.users))} of users`,
    },
    {
      icon: "📸",
      value: formatNumber(totals.posters),
      label: `${totals.posters === 1 ? "person has" : "people have"} posted, ${percent(share(totals.posters, totals.users))} of users`,
    },
    {
      icon: "🛡️",
      value: formatNumber(totals.admins),
      label: totals.admins === 1 ? "admin (that's you)" : "admins, including you",
    },
  ];

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {facts.map((fact) => (
        <li key={fact.icon} className="flex gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-white/[0.04]">
          <span aria-hidden className="text-xl leading-none">
            {fact.icon}
          </span>
          <div className="min-w-0">
            <p className="text-xl font-semibold tracking-tight">{fact.value}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{fact.label}</p>
            {fact.link && (
              <Link
                href={fact.link.href}
                className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                {fact.link.label}
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
