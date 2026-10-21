import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { MEME_COLUMNS, type MemeRow } from "@/components/memes/data";
import { DeleteMemeForm } from "@/components/memes/delete-meme-form";
import { MemeEditor } from "@/components/memes/meme-editor";
import { MembersOnlyBadge } from "@/components/memes/members-only-badge";
import { RecentVotes } from "@/components/memes/recent-votes";
import {
  BackLink,
  Badge,
  Card,
  DangerZone,
  Detail,
  LoadError,
  PageHeader,
  ViewInAppLink,
  hrefWith,
  linkClass,
} from "@/components/ui";
import { UpDownBar } from "@/components/up-down-bar";
import { VOTE_COLUMNS, type VoteRow } from "@/components/votes/data";
import { requireAdmin } from "@/lib/auth";
import { displayName, formatDateTime, fullName, parseId, plural, scoreTone, signedScore } from "@/lib/format";
import { mainAppUrl } from "@/lib/links";
import { memeImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Meme" };

const RECENT_VOTES = 10;

function When({ iso }: { iso: string }) {
  return (
    <>
      {formatDateTime(iso)} <span className="text-zinc-500 dark:text-zinc-400">({timeAgo(iso)})</span>
    </>
  );
}

export default async function MemeDetailPage({ params }: PageProps<"/memes/[id]">) {
  const { id: idParam } = await params;
  await requireAdmin(`/memes/${encodeURIComponent(idParam)}`);
  const id = parseId(idParam);
  if (!id) notFound();

  const supabase = await createClient();
  const [memeResult, votesResult] = await Promise.all([
    supabase.from("memes").select(MEME_COLUMNS).eq("id", id).maybeSingle(),
    supabase
      .from("admin_votes")
      .select(VOTE_COLUMNS)
      .eq("kind", "meme")
      .eq("item_id", id)
      .order("created_at", { ascending: false })
      .order("user_id", { ascending: true })
      .limit(RECENT_VOTES),
  ]);

  if (memeResult.error) {
    return (
      <div className="space-y-4">
        <BackLink href="/memes">All memes</BackLink>
        <LoadError what="this meme" error={memeResult.error} />
      </div>
    );
  }
  const meme = memeResult.data as MemeRow | null;
  if (!meme) notFound();

  // memes.user_id points at auth.users, not profiles, so PostgREST can't
  // embed the profile; it's a second, small query.
  const profileResult = meme.user_id
    ? await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", meme.user_id)
        .maybeSingle()
    : null;
  const profile = profileResult?.data as
    | { first_name: string | null; last_name: string | null; avatar_url: string | null }
    | null
    | undefined;
  const authorName = fullName(profile) || displayName(meme.author_name);

  const votes = (votesResult.data ?? []) as VoteRow[];
  const voteCount = meme.upvotes + meme.downvotes;
  const appUrl = mainAppUrl(`/m/${meme.id}`);

  return (
    <div className="space-y-6">
      <BackLink href="/memes">All memes</BackLink>

      <PageHeader
        title={meme.title}
        description={
          <span className="mt-1 flex flex-wrap gap-1.5">
            {meme.user_id ? <Badge>👤 Posted by {authorName}</Badge> : <Badge tone="amber">🖼️ Classic</Badge>}
            {meme.members_only && <MembersOnlyBadge />}
            <Badge tone={scoreTone(meme.score)}>Score {signedScore(meme.score)}</Badge>
          </span>
        }
        actions={appUrl && <ViewInAppLink href={appUrl} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
        <MemeEditor
          memeId={meme.id}
          imageUrl={memeImageUrl(meme)}
          saved={{
            title: meme.title,
            topText: meme.top_text ?? "",
            bottomText: meme.bottom_text ?? "",
            membersOnly: meme.members_only,
          }}
        />

        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Details">
            <dl className="-my-2.5 divide-y divide-zinc-100 dark:divide-zinc-800">
              <Detail label="Author">
                {meme.user_id ? (
                  <span className="flex flex-col gap-1">
                    <Link href={`/users/${meme.user_id}`} className="group flex items-center gap-2.5">
                      <Avatar src={profile?.avatar_url} name={authorName} decorative />
                      <span className="font-medium group-hover:underline">{authorName}</span>
                    </Link>
                    <Link href={hrefWith("/memes", { user: meme.user_id })} className={`text-xs ${linkClass}`}>
                      All their memes →
                    </Link>
                  </span>
                ) : (
                  "Nobody: a classic the app came with"
                )}
              </Detail>
              <Detail label="Posted">
                <When iso={meme.created_at} />
              </Detail>
              <Detail label="Newest vote">
                {votes[0] ? (
                  <When iso={votes[0].created_at} />
                ) : (
                  // A failed votes query isn't "no votes"; Recent votes says what went wrong.
                  <span className="text-zinc-500 dark:text-zinc-400">{votesResult.error ? "–" : "No votes yet"}</span>
                )}
              </Detail>
              <Detail label="Who sees it">
                {meme.members_only ? "Signed-in members only" : "Everyone, signed in or not"}
              </Detail>
              <Detail label="Image">
                {meme.image_path ? (
                  <>
                    Uploaded to Storage
                    <span className="mt-0.5 block truncate font-mono text-xs text-zinc-500 dark:text-zinc-400" title={meme.image_path}>
                      {meme.image_path}
                    </span>
                  </>
                ) : meme.image_url ? (
                  <a href={meme.image_url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    Hosted on imgflip ↗
                  </a>
                ) : (
                  <span className="text-zinc-500 dark:text-zinc-400">None</span>
                )}
              </Detail>
              <Detail label="Votes">
                <div className="tabular-nums">{plural(voteCount, "vote")}</div>
                <div className="mt-2">
                  <UpDownBar up={meme.upvotes} down={meme.downvotes} showCounts />
                </div>
              </Detail>
            </dl>
          </Card>

          <RecentVotes title={meme.title} votes={votes} total={voteCount} error={votesResult.error} />

          <DangerZone
            description={`Deletes the meme for everyone, with its ${plural(voteCount, "vote")}.${meme.image_path ? " The uploaded image is removed from Storage too." : ""}`}
          >
            <DeleteMemeForm
              memeId={meme.id}
              title={meme.title}
              voteCount={voteCount}
              uploaded={Boolean(meme.image_path)}
            />
          </DangerZone>
        </div>
      </div>
    </div>
  );
}
