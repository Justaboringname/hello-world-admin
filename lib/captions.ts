// Shared by the browser and the server: no secrets in here. Mirrors the main
// app's lib/captions.ts, so both apps agree on vibes, limits and paths.

export const PHOTO_BUCKET = "photos";
export const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const LOCATION_MAX_LENGTH = 60;

// captions.text is 1–200 characters, and a photo has at most 5 captions
// (supabase/captions.sql in the main app).
export const CAPTION_MAX_LENGTH = 200;
export const MAX_CAPTIONS = 5;

// The voice Gemini writes in. `instruction` goes into the saved prompt.
export const VIBES = {
  midwest: {
    label: "Midwest culture shock",
    emoji: "🌽",
    blurb: "Fresh off the plane and still shook",
    instruction:
      "a college junior who just moved to New York from the Midwest and is still amazed and slightly horrified by everything. Compare things to back home (Target parking lots, ranch dressing, saying \"ope\", driving everywhere). Wholesome but shook.",
  },
  online: {
    label: "Chronically online",
    emoji: "📱",
    blurb: "Lowercase, unhinged, posted at 2am",
    instruction:
      "a chronically online Gen Z college student. Lowercase, current internet slang and meme formats, like a viral tweet or TikTok comment. Never cringe or try-hard.",
  },
  columbia: {
    label: "Columbia life",
    emoji: "🦁",
    blurb: "Butler all-nighters and the 1 train",
    instruction:
      "a stressed Columbia College junior. Reference campus life where it fits: the Core, all-nighters in Butler Library, dorm life, dining hall food, Morningside Heights, the 1 train.",
  },
  newyorker: {
    label: "Jaded New Yorker",
    emoji: "🗽",
    blurb: "Seen it all, impressed by none of it",
    instruction:
      "a born-and-raised New Yorker who has seen it all. Deadpan, unimpressed, brutally efficient, a little rude but never mean.",
  },
} as const;

export type Vibe = keyof typeof VIBES;

export function isVibe(value: unknown): value is Vibe {
  return typeof value === "string" && Object.hasOwn(VIBES, value);
}

// <user id>/<random uuid>.<ext>. The first folder segment is the user id,
// which the storage and generations policies in supabase/captions.sql check.
export function photoPath(userId: string, contentType: string) {
  const ext = contentType.split("/")[1] === "jpeg" ? "jpg" : contentType.split("/")[1];
  return `${userId}/${crypto.randomUUID()}.${ext}`;
}

export type VoteValue = 1 | -1;

export type Caption = {
  id: number;
  position: number;
  text: string;
  upvotes: number;
  downvotes: number;
  score: number;
};

export type Generation = {
  id: number;
  author_name: string | null;
  image_path: string;
  location: string | null;
  vibe: string;
  created_at: string;
  captions: Caption[];
};

export type Meme = {
  id: number;
  title: string;
  image_url: string | null; // the seeded classics, hosted on imgflip
  image_path: string | null; // memes people post, in the photos bucket
  top_text: string | null;
  bottom_text: string | null;
  members_only: boolean;
  author_name: string | null;
  upvotes: number;
  downvotes: number;
  score: number;
  created_at: string;
};

// Limits for memes. The main app's supabase/meme_votes.sql enforces the same
// lengths as a check constraint.
export const MEME_TITLE_MAX_LENGTH = 80;
export const MEME_TEXT_MAX_LENGTH = 100;

export type GenerationDetail = Generation & {
  system_prompt: string;
  prompt: string;
  model: string;
};

export function vibeLabel(vibe: string) {
  return isVibe(vibe) ? `${VIBES[vibe].emoji} ${VIBES[vibe].label}` : vibe;
}
