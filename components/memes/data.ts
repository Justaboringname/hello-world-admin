import type { Meme } from "@/lib/captions";
import { displayName } from "@/lib/format";

// Row shapes and URL options for the /memes pages. The Supabase client is
// untyped, so these mirror the memes table (main app's supabase/meme_votes.sql).

export type MemeRow = Meme & {
  // null for the seeded imgflip classics, which nobody posted.
  user_id: string | null;
};

export const MEME_COLUMNS =
  "id, title, image_url, image_path, top_text, bottom_text, members_only, user_id, author_name, upvotes, downvotes, score, created_at";

// Column names end up in the PostgREST query, so they come from here and
// never from the URL.
export const MEME_SEARCH_COLUMNS = ["title", "top_text", "bottom_text", "author_name"] as const;

export const MEME_SHOWS = {
  all: "All memes",
  members: "🔓 Members only",
  users: "👤 Posted by users",
  classics: "🖼️ Classics",
} as const;

export type MemeShow = keyof typeof MEME_SHOWS;
export const DEFAULT_MEME_SHOW: MemeShow = "all";

export const MEME_SORTS = {
  new: "Newest",
  top: "Top score",
  bottom: "Lowest score",
} as const;

export type MemeSort = keyof typeof MEME_SORTS;
export const DEFAULT_MEME_SORT: MemeSort = "new";

// One of a fixed set of URL options, or the default for anything else
// (missing, misspelled, or a property like "toString").
export function oneOf<K extends string>(
  options: Record<K, unknown>,
  value: string | undefined,
  fallback: K,
): K {
  return value !== undefined && Object.hasOwn(options, value) ? (value as K) : fallback;
}

// The top and bottom text are real text laid over the image, so screen
// readers get them anyway; the alt only has to say what the picture is.
export function memeAlt(meme: Pick<Meme, "title">) {
  return `Meme image: ${meme.title}`;
}

// Classics came with the app; everything else has a poster.
export function memeAuthor(meme: Pick<MemeRow, "user_id" | "author_name">) {
  if (!meme.user_id) return "Classic";
  return displayName(meme.author_name);
}
