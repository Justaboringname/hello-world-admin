import "server-only";
import { createClient } from "@/lib/supabase/server";

// The shape of admin_dashboard() in supabase/admin.sql. Counts arrive as JSON
// numbers; averages are null when there's nothing to average.

type Person = { user_id: string; name: string | null; avatar_url: string | null };

export type RankedCaption = {
  id: number;
  text: string;
  position: number;
  upvotes: number;
  downvotes: number;
  score: number;
  generation_id: number;
  image_path: string;
  vibe: string;
  author_name: string | null;
};

export type Dashboard = {
  generated_at: string;
  timezone: string;
  totals: {
    users: number;
    admins: number;
    photos: number;
    captions: number;
    memes: number;
    user_memes: number;
    votes: number;
    upvotes: number;
    downvotes: number;
    voters: number;
    posters: number;
    unvoted_posts: number;
  };
  last_7_days: { users: number; posts: number; votes: number; active_users: number };
  previous_7_days: { users: number; posts: number; votes: number; active_users: number };
  // 30 entries, oldest first. `day` is YYYY-MM-DD in New York.
  daily: { day: string; signups: number; photos: number; memes: number; votes: number }[];
  // Only cells with votes. dow: 0 = Sunday ... 6 = Saturday; hour: 0-23.
  heatmap: { dow: number; hour: number; votes: number }[];
  funnel: { signed_up: number; named: number; voted: number; posted: number; regulars: number };
  vibes: {
    vibe: string;
    photos: number;
    captions: number;
    upvotes: number;
    downvotes: number;
    avg_score: number | null;
  }[];
  // wins: photos where the caption in this position leads outright.
  positions: {
    position: number;
    captions: number;
    upvotes: number;
    downvotes: number;
    avg_score: number | null;
    wins: number;
  }[];
  decided_photos: number;
  models: {
    model: string;
    photos: number;
    upvotes: number;
    downvotes: number;
    avg_score: number | null;
  }[];
  kinds: Record<
    "photo" | "meme",
    { posts: number; voted_posts: number; upvotes: number; downvotes: number }
  >;
  top_captions: RankedCaption[];
  divisive_captions: RankedCaption[];
  top_memes: {
    id: number;
    title: string;
    image_url: string | null;
    image_path: string | null;
    author_name: string | null;
    members_only: boolean;
    upvotes: number;
    downvotes: number;
    score: number;
  }[];
  top_creators: (Person & { posts: number; upvotes: number })[];
  top_voters: (Person & { votes: number; upvotes: number; days: number })[];
  // null when nobody qualifies yet.
  awards: {
    harshest_critic: (Person & { votes: number; upvotes: number }) | null;
    biggest_fan: (Person & { votes: number; upvotes: number }) | null;
    night_owl: (Person & { votes: number; late_night: number }) | null;
  };
  locations: { location: string; photos: number }[];
  // Median minutes from posting to the first vote; null before any votes.
  first_vote_minutes: number | null;
};

export async function getDashboard() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_dashboard");
  return { dashboard: (data ?? null) as Dashboard | null, error };
}
