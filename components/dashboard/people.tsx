import Link from "next/link";
import { Avatar } from "@/components/avatar";
import type { Dashboard } from "@/lib/dashboard";
import { displayName, formatNumber, plural } from "@/lib/format";
import { percent, share } from "./numbers";
import { NoData, Rank } from "./panel";

type Person = { user_id: string; name: string | null; avatar_url: string | null };

const hover =
  "rounded-xl transition hover:bg-zinc-50 focus-visible:bg-zinc-50 dark:hover:bg-white/5 dark:focus-visible:bg-white/5";

function PersonRow({
  rank,
  person,
  primary,
  secondary,
}: {
  rank: number;
  person: Person;
  primary: React.ReactNode;
  secondary: React.ReactNode;
}) {
  const name = displayName(person.name);
  return (
    <li>
      <Link href={`/users/${person.user_id}`} className={`flex items-center gap-3 p-2 ${hover}`}>
        <Rank value={rank} />
        <Avatar src={person.avatar_url} name={name} decorative />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums">{primary}</span>
          <span className="block text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{secondary}</span>
        </span>
      </Link>
    </li>
  );
}

export function CreatorList({ creators }: { creators: Dashboard["top_creators"] }) {
  return (
    <ol className="-mx-2 space-y-0.5">
      {creators.map((person, index) => (
        <PersonRow
          key={person.user_id}
          rank={index + 1}
          person={person}
          primary={`👍 ${formatNumber(person.upvotes)}`}
          secondary={plural(person.posts, "post")}
        />
      ))}
    </ol>
  );
}

export function VoterList({ voters }: { voters: Dashboard["top_voters"] }) {
  return (
    <ol className="-mx-2 space-y-0.5">
      {voters.map((person, index) => (
        <PersonRow
          key={person.user_id}
          rank={index + 1}
          person={person}
          primary={plural(person.votes, "vote")}
          secondary={`${percent(share(person.upvotes, person.votes))} 👍 · ${plural(person.days, "day")}`}
        />
      ))}
    </ol>
  );
}

type Awards = Dashboard["awards"];

// With only one voter past 5 votes, the SQL names them both harshest critic
// and biggest fan. Keep whichever title fits them.
export function settleAwards(awards: Awards): Awards {
  const { harshest_critic: critic, biggest_fan: fan } = awards;
  if (!critic || !fan || critic.user_id !== fan.user_id) return awards;
  const rate = share(fan.upvotes, fan.votes) ?? 0;
  return rate >= 0.5 ? { ...awards, harshest_critic: null } : { ...awards, biggest_fan: null };
}

export function AwardList({ awards }: { awards: Awards }) {
  const { harshest_critic: critic, biggest_fan: fan, night_owl: owl } = awards;
  if (!critic && !fan && !owl) {
    return <NoData>Awards unlock once people cast 5 or more votes.</NoData>;
  }
  // One of the pair is empty either because nobody has 5 votes yet or because
  // settleAwards gave the only qualifier the other title.
  const needsVoter = critic || fan ? "Needs a second voter with 5+ votes" : "Needs someone with 5+ votes";
  return (
    <ul className="space-y-3">
      <Award
        icon="🧐"
        title="Harshest critic"
        person={critic}
        detail={
          critic &&
          `👍 on just ${percent(share(critic.upvotes, critic.votes))} of ${formatNumber(critic.votes)} votes`
        }
        pending={needsVoter}
      />
      <Award
        icon="🥰"
        title="Biggest fan"
        person={fan}
        detail={fan && `👍 on ${percent(share(fan.upvotes, fan.votes))} of ${formatNumber(fan.votes)} votes`}
        pending={needsVoter}
      />
      <Award
        icon="🦉"
        title="Night owl"
        person={owl}
        detail={
          owl &&
          `${formatNumber(owl.late_night)} of ${formatNumber(owl.votes)} votes cast between midnight and 5\u00a0AM`
        }
        pending="Nobody has voted after midnight yet"
      />
    </ul>
  );
}

function Award({
  icon,
  title,
  person,
  detail,
  pending,
}: {
  icon: string;
  title: string;
  person: Person | null;
  detail: React.ReactNode;
  pending: string;
}) {
  const body = (
    <>
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xl dark:bg-zinc-800">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {title}
        </span>
        {person ? (
          <>
            <span className="mt-0.5 flex items-center gap-2 text-sm font-semibold">
              <Avatar src={person.avatar_url} name={displayName(person.name)} decorative />
              <span className="truncate">{displayName(person.name)}</span>
            </span>
            <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{detail}</span>
          </>
        ) : (
          <span className="mt-0.5 block text-sm text-zinc-500 dark:text-zinc-400">{pending}</span>
        )}
      </span>
    </>
  );

  return (
    <li>
      {person ? (
        <Link href={`/users/${person.user_id}`} className={`-mx-2 flex items-start gap-3 p-2 ${hover}`}>
          {body}
        </Link>
      ) : (
        <div className="-mx-2 flex items-start gap-3 p-2">{body}</div>
      )}
    </li>
  );
}
