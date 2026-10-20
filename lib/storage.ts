import { PHOTO_BUCKET, type Meme } from "@/lib/captions";
import { supabaseEnv } from "@/lib/supabase/env";

// The photos bucket is public, so the URL can be built without a request.
export function photoUrl(path: string) {
  return `${supabaseEnv().url}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

// Memes people post live in the photos bucket; the seeded classics are on imgflip.
export function memeImageUrl(meme: Pick<Meme, "image_url" | "image_path">) {
  return meme.image_path ? photoUrl(meme.image_path) : (meme.image_url ?? "");
}
