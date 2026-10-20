import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { MEME_COLUMNS, type MemeRow } from "@/components/memes/data";
import { DeleteMemeForm } from "@/components/memes/delete-meme-form";
import { MemeEditor } from "@/components/memes/meme-editor";
import { RecentVotes } from "@/components/memes/recent-votes";
import { Badge, Card, ErrorNote, PageHeader, hrefWith } from "@/components/ui";
import { VOTE_COLUMNS, type VoteRow } from "@/components/votes/data";
import { RatingBar } from "@/components/votes/rating-bar";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatNumber, fullName, parseId, scoreTone, signedScore } from "@/lib/format";
import { mainAppUrl } from "@/lib/links";
import { memeImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Meme" };

const RECENT_VOTES = 10;

const linkClass = "font-medium text-blue-600 hover:underline dark:text-blue-400";

function BackLink() {
  return (
    <Link href="/memes" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
      ← All memes
    </Link>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-sm text-zinc-500 sm:w-24">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-sm">{children}</dd>
    </div>
  );
}

function When({ iso }: { iso: string }) {
  return (
    <>
      {formatDateTime(iso)} <span className="text-zinc-500">({timeAgo(iso)})</span>
    </>
  );
}

export default async function MemeDetailPage({ params }: PageProps<"/memes/[id]">) {
  await requireAdmin(`/memes/${encodeURIComponent((await params).id)}`);
  const id = parseId((await params).id);
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
      <>
        <BackLink />
        <div className="mt-4">
          <ErrorNote>Couldn&apos;t load this meme: {memeResult.error.message}</ErrorNote>
        </div>
      </>
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
  const authorName = fullName(profile) || meme.author_name || "Unnamed user";

  const votes = (votesResult.data ?? []) as VoteRow[];
  const voteCount = meme.upvotes + meme.downvotes;
  const appUrl = mainAppUrl(`/m/${meme.id}`);

  return (
    <>
      <BackLink />
      <div className="mt-3">
        <PageHeader
          title={meme.title}
          description={
            <span className="mt-1 flex flex-wrap gap-1.5">
              {meme.user_id ? <Badge>👤 Posted by {authorName}</Badge> : <Badge tone="amber">🖼️ Classic</Badge>}
              {meme.members_only && <Badge tone="blue">🔓 Members only</Badge>}
              <Badge tone={scoreTone(meme.score)}>Score {signedScore(meme.score)}</Badge>
            </span>
          }
          actions={
            appUrl && (
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                View in app ↗
              </a>
            )
          }
        />
      </div>

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
                      <Avatar src={profile?.avatar_url} name={authorName} />
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
                  <span className="text-zinc-500">{votesResult.error ? "–" : "No votes yet"}</span>
                )}
              </Detail>
              <Detail label="Who sees it">
                {meme.members_only ? "Signed-in members only" : "Everyone, signed in or not"}
              </Detail>
              <Detail label="Image">
                {meme.image_path ? (
                  <>
                    Uploaded to Storage
                    <span className="mt-0.5 block truncate font-mono text-xs text-zinc-500" title={meme.image_path}>
                      {meme.image_path}
                    </span>
                  </>
                ) : meme.image_url ? (
                  <a href={meme.image_url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    Hosted on imgflip ↗
                  </a>
                ) : (
                  <span className="text-zinc-500">None</span>
                )}
              </Detail>
              <Detail label="Votes">
                <div className="tabular-nums">
                  {formatNumber(voteCount)} {voteCount === 1 ? "vote" : "votes"}
                </div>
                <div className="mt-2">
                  <RatingBar up={meme.upvotes} down={meme.downvotes} />
                </div>
              </Detail>
            </dl>
          </Card>

          <RecentVotes
            title={meme.title}
            votes={votes}
            total={voteCount}
            error={votesResult.error ? votesResult.error.message || "the database didn't answer." : null}
          />

          <Card
            title="Delete"
            description={
              meme.image_path
                ? "Removes the meme, its votes and its uploaded image."
                : "Removes the meme and its votes."
            }
          >
            <DeleteMemeForm
              memeId={meme.id}
              title={meme.title}
              voteCount={voteCount}
              uploaded={Boolean(meme.image_path)}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
