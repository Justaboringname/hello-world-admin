import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  USER_MEME_COLUMNS,
  USER_PHOTO_COLUMNS,
  type AdminUser,
  type UserMeme,
  type UserPhoto,
} from "@/components/users/data";
import { BackLink, LoadError, hrefWith } from "@/components/ui";
import { ProfileCard } from "@/components/users/profile-card";
import { StatTile } from "@/components/users/stat-tile";
import { UserMemes } from "@/components/users/user-memes";
import { UserPhotos } from "@/components/users/user-photos";
import { UserVotes } from "@/components/users/user-votes";
import { VOTE_COLUMNS, type VoteRow } from "@/components/votes/data";
import { requireAdmin } from "@/lib/auth";
import { formatPercent, parseUuid } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "User" };

// Thumbnails per grid (divides evenly into 2, 3, 4 and 6 columns) and votes
// in the list. "See all" opens the full, filtered admin list.
const GRID_SIZE = 12;
const VOTES_SHOWN = 15;

export default async function UserPage({ params }: PageProps<"/users/[id]">) {
  const { id } = await params;
  const admin = await requireAdmin(`/users/${encodeURIComponent(id)}`);
  const userId = parseUuid(id);
  if (!userId) notFound();

  const supabase = await createClient();
  const [userResult, photosResult, memesResult, votesResult, upvotesResult] = await Promise.all([
    supabase.rpc("admin_users").eq("id", userId).maybeSingle(),
    supabase
      .from("admin_generations")
      .select(USER_PHOTO_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(GRID_SIZE),
    supabase
      .from("memes")
      .select(USER_MEME_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(GRID_SIZE),
    supabase
      .from("admin_votes")
      .select(VOTE_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      // Votes cast in the same instant keep a stable order.
      .order("kind", { ascending: true })
      .order("item_id", { ascending: true })
      .limit(VOTES_SHOWN),
    // Just the 👍 count, for their upvote share across every vote, not only
    // the ones listed.
    supabase
      .from("admin_votes")
      .select("item_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("vote", 1),
  ]);

  if (userResult.error) {
    return (
      <div className="space-y-4">
        <BackLink href="/users">All users</BackLink>
        <LoadError what="this user" error={userResult.error} />
      </div>
    );
  }
  const user = userResult.data as AdminUser | null;
  if (!user) notFound();

  const upvotesCast = upvotesResult.count;

  return (
    <div className="space-y-6">
      <BackLink href="/users">All users</BackLink>
      <ProfileCard user={user} isYou={user.id === admin.userId} />

      <section aria-label="Activity" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="AI photos"
          value={user.photos}
          href={hrefWith("/media", { user: user.id })}
          hint="Posted for Gemini to caption"
        />
        <StatTile
          label="Memes"
          value={user.memes}
          href={hrefWith("/memes", { user: user.id })}
          hint="Made in the app"
        />
        <StatTile
          label="Votes cast"
          value={user.votes_cast}
          href={hrefWith("/votes", { user: user.id })}
          hint={
            upvotesCast !== null && user.votes_cast > 0
              ? `${formatPercent(upvotesCast, user.votes_cast)} 👍`
              : "On captions and memes"
          }
        />
        <StatTile
          label="👍 received"
          value={user.upvotes_received}
          hint="On their photos' captions and memes"
        />
      </section>

      <UserPhotos
        userId={user.id}
        photos={(photosResult.data ?? []) as UserPhoto[]}
        total={user.photos}
        error={photosResult.error?.message ?? null}
      />
      <UserMemes
        userId={user.id}
        memes={(memesResult.data ?? []) as UserMeme[]}
        total={user.memes}
        error={memesResult.error?.message ?? null}
      />
      <UserVotes
        userId={user.id}
        votes={(votesResult.data ?? []) as VoteRow[]}
        total={user.votes_cast}
        upvotes={upvotesCast}
        error={votesResult.error?.message ?? null}
      />
    </div>
  );
}
