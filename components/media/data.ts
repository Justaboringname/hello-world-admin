import type { Caption } from "@/lib/captions";
import { formatNumber } from "@/lib/format";

// Row shapes and URL options for the /media pages. The Supabase client is
// untyped, so these mirror the generations and captions tables and the
// admin_generations view in supabase/admin.sql. bigint counts arrive as plain
// JSON numbers.

export type MediaRow = {
  id: number;
  user_id: string;
  author_name: string | null;
  image_path: string;
  location: string | null;
  vibe: string;
  model: string;
  created_at: string;
  caption_count: number;
  upvotes: number;
  downvotes: number;
  score: number;
  top_caption: string | null;
};

export const MEDIA_ROW_COLUMNS =
  "id, user_id, author_name, image_path, location, vibe, model, created_at, caption_count, upvotes, downvotes, score, top_caption";

// Column names end up in the PostgREST query, so they come from here and
// never from the URL.
export const MEDIA_SEARCH_COLUMNS = ["location", "author_name", "caption_text", "model"] as const;

export type MediaDetail = {
  id: number;
  user_id: string;
  author_name: string | null;
  image_path: string;
  location: string | null;
  vibe: string;
  system_prompt: string;
  prompt: string;
  model: string;
  created_at: string;
  captions: Caption[];
};

export const MEDIA_DETAIL_COLUMNS =
  "id, user_id, author_name, image_path, location, vibe, system_prompt, prompt, model, created_at, captions(id, position, text, upvotes, downvotes, score)";

export const MEDIA_SORTS = {
  new: "Newest",
  old: "Oldest",
  top: "Top score",
  bottom: "Lowest score",
  unvoted: "No votes yet",
} as const;

export type MediaSort = keyof typeof MEDIA_SORTS;

export const DEFAULT_MEDIA_SORT: MediaSort = "new";

export function parseMediaSort(value: string | undefined): MediaSort {
  return value && Object.hasOwn(MEDIA_SORTS, value) ? (value as MediaSort) : DEFAULT_MEDIA_SORT;
}


// Captions and locations are saved as one tidy line. The caption editor
// compares with the same rule, so "unsaved" means the server would save
// something different.
export function tidyText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function plural(count: number, one: string, many: string) {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}



export function photoAlt(photo: { location: string | null; author_name: string | null }) {
  const where = photo.location ? ` from ${photo.location}` : "";
  const who = photo.author_name ? ` posted by ${photo.author_name}` : "";
  return `Photo${where}${who}`;
}

// The caption that leads outright: top score, above zero, no tie. Same rule
// as the crown in the main app.
export function topCaptionId(captions: Caption[]) {
  const [first, second] = [...captions].sort((a, b) => b.score - a.score);
  if (!first || first.score <= 0 || (second && second.score === first.score)) return null;
  return first.id;
}
