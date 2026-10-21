import type { MemeRow } from "@/components/memes/data";
import type { VoteValue } from "@/lib/captions";

// Row shapes and URL options for /votes. The Supabase client is untyped, so
// these mirror the admin_votes view in supabase/admin.sql and the captions
// and memes tables.

// For a caption vote, item_id is the caption and post_id its photo; for a
// meme vote both are the meme.
export type VoteRow = {
  kind: "caption" | "meme";
  item_id: number;
  post_id: number;
  label: string;
  user_id: string;
  voter_name: string | null;
  voter_avatar_url: string | null;
  vote: VoteValue;
  created_at: string;
  updated_at: string;
};

export const VOTE_COLUMNS =
  "kind, item_id, post_id, label, user_id, voter_name, voter_avatar_url, vote, created_at, updated_at";

export type CaptionRating = {
  id: number;
  text: string;
  position: number;
  upvotes: number;
  downvotes: number;
  score: number;
  generation_id: number;
  // Many captions to one photo, so PostgREST embeds an object, not a list.
  generations: { id: number; image_path: string; vibe: string } | null;
};

export const CAPTION_RATING_COLUMNS =
  "id, text, position, upvotes, downvotes, score, generation_id, generations(id, image_path, vibe)";

export type MemeRating = Pick<
  MemeRow,
  | "id"
  | "title"
  | "image_url"
  | "image_path"
  | "members_only"
  | "user_id"
  | "author_name"
  | "upvotes"
  | "downvotes"
  | "score"
>;

export const MEME_RATING_COLUMNS =
  "id, title, image_url, image_path, members_only, user_id, author_name, upvotes, downvotes, score";

export const VOTE_TABS = {
  votes: "All votes",
  ratings: "Ratings",
} as const;

export type VoteTab = keyof typeof VOTE_TABS;
export const DEFAULT_VOTE_TAB: VoteTab = "votes";

export const VOTE_KINDS = {
  all: "Everything",
  caption: "📸 Captions",
  meme: "😂 Memes",
} as const;

export type VoteKind = keyof typeof VOTE_KINDS;
export const DEFAULT_VOTE_KIND: VoteKind = "all";

export const VOTE_VALUES = {
  all: "👍 and 👎",
  up: "👍 only",
  down: "👎 only",
} as const;

export type VoteFilter = keyof typeof VOTE_VALUES;
export const DEFAULT_VOTE_FILTER: VoteFilter = "all";

// "Most voted" and "most divisive" order by total_votes and minority_votes,
// computed fields in supabase/admin.sql: PostgREST orders by columns only.
export const RATING_SORTS = {
  top: "Top rated",
  bottom: "Lowest rated",
  voted: "Most voted",
  divisive: "Most divisive",
} as const;

export type RatingSort = keyof typeof RATING_SORTS;
export const DEFAULT_RATING_SORT: RatingSort = "top";

// Columns to order the ratings by, most significant first.
export function ratingOrder(sort: RatingSort): { column: string; ascending: boolean }[] {
  switch (sort) {
    case "bottom":
      return [
        { column: "score", ascending: true },
        { column: "downvotes", ascending: false },
      ];
    case "voted":
      return [
        { column: "total_votes", ascending: false },
        { column: "score", ascending: false },
      ];
    // Most votes on the smaller side: 6👍 6👎 splits opinion more than 20👍 1👎.
    case "divisive":
      return [
        { column: "minority_votes", ascending: false },
        { column: "total_votes", ascending: false },
      ];
    default:
      return [
        { column: "score", ascending: false },
        { column: "upvotes", ascending: false },
      ];
  }
}

// What a vote was on: a caption opens its photo, a meme opens the meme.
export function voteHref(vote: Pick<VoteRow, "kind" | "item_id" | "post_id">) {
  return vote.kind === "caption" ? `/media/${vote.post_id}` : `/memes/${vote.item_id}`;
}

// The main app stamps updated_at whenever someone votes on the same item
// again, so a gap of over a minute means they came back and changed it.
export function wasChanged(vote: Pick<VoteRow, "created_at" | "updated_at">) {
  return Date.parse(vote.updated_at) - Date.parse(vote.created_at) > 60_000;
}

export function voterName(vote: Pick<VoteRow, "voter_name">) {
  return vote.voter_name ?? "Unnamed user";
}
