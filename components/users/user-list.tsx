import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui";
import { displayName, formatNumber, fullName } from "@/lib/format";
import { avatarName, providerLabel, type AdminUser } from "./data";
import { When, whenTitle } from "./when";

function UserName({ user }: { user: AdminUser }) {
  return (
    <span className={`truncate ${fullName(user) ? "font-medium" : "italic text-zinc-500 dark:text-zinc-400"}`}>
      {displayName(user)}
    </span>
  );
}

// A table cell that opens the user wherever it's clicked. The overlay link is
// hidden from keyboards and screen readers, which get the one real link in
// the user cell rather than eight copies per row; the cell's own text stays
// readable. It carries the hover text, since it sits on top. (One link
// stretched over the whole row needs position: relative on a <tr>, which
// isn't reliable in every browser. On a <td> it is.)
function Cell({
  href,
  title,
  className = "",
  children,
}: {
  href: string;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <td className={`relative px-3 py-2.5 ${className}`}>
      {children}
      <Link
        href={href}
        title={title}
        tabIndex={-1}
        aria-hidden
        prefetch={false}
        className="absolute inset-0"
      />
    </td>
  );
}

const COUNTS = [
  { key: "photos", label: "Photos" },
  { key: "memes", label: "Memes" },
  { key: "votes_cast", label: "Votes cast" },
  { key: "upvotes_received", label: "👍 received" },
] as const;

// One page of users: stacked cards on phones, a table from md up. Read-only,
// so each row is just a link to the user's page.
export function UserList({ users }: { users: AdminUser[] }) {
  return (
    <>
      <ul className="space-y-3 md:hidden">
        {users.map((user) => (
          <li key={user.id}>
            <Link
              href={`/users/${user.id}`}
              className="block rounded-2xl border border-zinc-200 bg-surface p-4 shadow-sm transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700"
            >
              <div className="flex items-center gap-3">
                <Avatar src={user.avatar_url} name={avatarName(user)} decorative />
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-2">
                    <UserName user={user} />
                    {user.is_superadmin && <Badge tone="violet">Superadmin</Badge>}
                  </p>
                  <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{user.email ?? "No email"}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {providerLabel(user.provider)} · joined <When iso={user.created_at} show="date" /> ·
                last sign-in <When iso={user.last_sign_in_at} show="ago" never="never" />
              </p>
              <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-zinc-100 pt-3 text-center dark:border-zinc-800">
                {COUNTS.map(({ key, label }) => (
                  <div key={key}>
                    <dt className="text-[0.7rem] text-zinc-500 dark:text-zinc-400">{label}</dt>
                    <dd className="font-semibold tabular-nums">{formatNumber(user[key])}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl border border-zinc-200 bg-surface shadow-sm md:block dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Users</caption>
          <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:text-zinc-400 dark:border-zinc-800">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                User
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Provider
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 font-medium">
                Joined
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 font-medium">
                Last sign-in
              </th>
              {COUNTS.map(({ key, label }) => (
                <th key={key} scope="col" className="whitespace-nowrap px-3 py-3 text-right font-medium last:pr-4">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((user) => {
              const href = `/users/${user.id}`;
              return (
                <tr key={user.id} className="group transition hover:bg-zinc-50 dark:hover:bg-white/[0.03]">
                  <td className="max-w-80 p-0">
                    <Link href={href} className="flex min-w-0 items-center gap-3 px-4 py-2.5">
                      <Avatar src={user.avatar_url} name={avatarName(user)} decorative />
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-2 group-hover:underline">
                          <UserName user={user} />
                          {user.is_superadmin && <Badge tone="violet">Superadmin</Badge>}
                        </span>
                        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {user.email ?? "No email"}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <Cell href={href} className="text-zinc-600 dark:text-zinc-400">
                    {providerLabel(user.provider)}
                  </Cell>
                  <Cell
                    href={href}
                    title={whenTitle(user.created_at, "date")}
                    className="whitespace-nowrap tabular-nums text-zinc-600 dark:text-zinc-400"
                  >
                    <When iso={user.created_at} show="date" />
                  </Cell>
                  <Cell
                    href={href}
                    title={whenTitle(user.last_sign_in_at, "ago")}
                    className="whitespace-nowrap text-zinc-600 dark:text-zinc-400"
                  >
                    <When iso={user.last_sign_in_at} show="ago" />
                  </Cell>
                  {COUNTS.map(({ key }) => (
                    <Cell key={key} href={href} className="text-right tabular-nums last:pr-4">
                      {user[key] ? formatNumber(user[key]) : <span className="text-zinc-500 dark:text-zinc-400">0</span>}
                    </Cell>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
