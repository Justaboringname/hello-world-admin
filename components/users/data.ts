import type { Meme } from "@/lib/captions";
import { fullName } from "@/lib/format";

// Row shapes for the users pages. The Supabase client is untyped, so these
// mirror admin_users() and the admin_generations view in supabase/admin.sql
// (a user's votes are VoteRows, from components/votes/data.ts). Counts are
// bigint there, which PostgREST sends as plain JSON numbers.

export type AdminUser = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
  provider: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  photos: number;
  memes: number;
  votes_cast: number;
  upvotes_received: number;
};

export type UserPhoto = {
  id: number;
  image_path: string;
  location: string | null;
  vibe: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  score: number;
  top_caption: string | null;
};

export const USER_PHOTO_COLUMNS =
  "id, image_path, location, vibe, created_at, upvotes, downvotes, score, top_caption";

export type UserMeme = Pick<
  Meme,
  | "id"
  | "title"
  | "image_url"
  | "image_path"
  | "top_text"
  | "bottom_text"
  | "members_only"
  | "upvotes"
  | "downvotes"
  | "score"
  | "created_at"
>;

export const USER_MEME_COLUMNS =
  "id, title, image_url, image_path, top_text, bottom_text, members_only, upvotes, downvotes, score, created_at";

// The sort tabs on /users. Column names end up in the query string, so they
// come from this list and never from the URL.
export const USER_SORTS = {
  new: { label: "Newest", column: "created_at" },
  active: { label: "Most votes cast", column: "votes_cast" },
  upvotes: { label: "Most 👍 received", column: "upvotes_received" },
  seen: { label: "Last signed in", column: "last_sign_in_at" },
} as const;

export type UserSort = keyof typeof USER_SORTS;

export const DEFAULT_USER_SORT: UserSort = "new";

export function parseUserSort(value: string | undefined): UserSort {
  return value && Object.hasOwn(USER_SORTS, value) ? (value as UserSort) : DEFAULT_USER_SORT;
}

// Avatar initials and alt text need something even before the user has
// typed a name.
export function avatarName(user: Pick<AdminUser, "first_name" | "last_name" | "email">) {
  return fullName(user) || user.email || "User";
}

// "google" -> "Google". Supabase stores the provider in lower case.
export function providerLabel(provider: string | null) {
  if (!provider) return "–";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}
