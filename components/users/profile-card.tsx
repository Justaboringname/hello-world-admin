import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui";
import { formatDateTime, fullName } from "@/lib/format";
import { timeAgo } from "@/lib/time";
import { avatarName, providerLabel, type AdminUser } from "./data";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function Moment({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-zinc-500 dark:text-zinc-400">Never</span>;
  return (
    <>
      <time dateTime={iso}>{formatDateTime(iso)}</time>
      <span className="block text-xs text-zinc-500 dark:text-zinc-400">{timeAgo(iso)}</span>
    </>
  );
}

// The top of a user's page: who they are, as Google and their profile say.
export function ProfileCard({ user, isYou }: { user: AdminUser; isYou: boolean }) {
  const name = fullName(user);

  return (
    <section
      aria-label="Profile"
      className="rounded-2xl border border-zinc-200 bg-surface p-6 shadow-sm dark:border-zinc-800"
    >
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
        <Avatar src={user.avatar_url} name={avatarName(user)} size="lg" />
        <div className="w-full min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight">
              {name || <span className="italic text-zinc-500 dark:text-zinc-400">No name yet</span>}
            </h1>
            {user.is_superadmin && <Badge tone="violet">Superadmin</Badge>}
            {isYou && <Badge tone="blue">You</Badge>}
          </div>
          <p className="mt-0.5 break-all text-sm text-zinc-500 dark:text-zinc-400">{user.email ?? "No email on file"}</p>
          {/* The panel can't change the flag on purpose: a trigger in
              admin.sql blocks it from the app, so it can't be self-granted. */}
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {user.is_superadmin ? "Can use this admin panel. " : "Not an admin. "}
            Admin access is granted and removed in the Supabase SQL Editor (step 8 of
            admin.sql), not here.
          </p>

          <dl className="mt-5 grid gap-x-6 gap-y-4 text-left text-sm sm:grid-cols-2 xl:grid-cols-4">
            <Detail label="Signed in with">{providerLabel(user.provider)}</Detail>
            <Detail label="Joined">
              <Moment iso={user.created_at} />
            </Detail>
            <Detail label="Last sign-in">
              <Moment iso={user.last_sign_in_at} />
            </Detail>
            <Detail label="User id">
              <span className="break-all font-mono text-xs">{user.id}</span>
            </Detail>
          </dl>
        </div>
      </div>
    </section>
  );
}
