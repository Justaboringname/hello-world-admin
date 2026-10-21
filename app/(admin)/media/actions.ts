"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { tidyText } from "@/components/media/data";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import {
  CAPTION_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  MANUAL_MODEL,
  MAX_CAPTIONS,
  PHOTO_BUCKET,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  isVibe,
  photoPath,
} from "@/lib/captions";
import { CaptionError, generateCaptions } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

// Every action here is a public POST endpoint. requireAdmin() decides who may
// call it, RLS and the column grants in admin.sql decide what it can touch,
// and ids are checked again because bound arguments come from the browser.

const MANUAL_SYSTEM_PROMPT = "";
const MANUAL_PROMPT = "Captions written by an admin in the admin panel.";

// A caption with its photo's author, embedded through captions.generation_id.
// PostgREST sends that photo as one object (many-to-one); the untyped client
// can't know and guesses a list, so rows are cast through unknown.
type CaptionOwner = { generation_id: number; generations: { user_id: string } | null };

function fail(message: string): ActionState {
  return { status: "error", message };
}

function isId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

// Form text as one tidy line, the way the main app saves it.
function oneLine(value: FormDataEntryValue | null) {
  return typeof value === "string" ? tidyText(value) : "";
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// The declared type is only what the request claims; the first bytes say what
// the file really is. That matters most for "Write them myself": nothing else
// looks at the file (Gemini would refuse a non-photo) before it's public.
function sniffImageType(bytes: Buffer) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return "image/png";
  if (bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

// The captions table allows 1–200 characters.
function checkCaption(text: string) {
  if (!text) return "Write a caption first.";
  if (text.length > CAPTION_MAX_LENGTH) {
    return `Keep captions to ${CAPTION_MAX_LENGTH} characters (this one is ${text.length}).`;
  }
  return null;
}

function checkLocation(location: string | null) {
  return location && location.length > LOCATION_MAX_LENGTH
    ? `Keep the location to ${LOCATION_MAX_LENGTH} characters.`
    : null;
}

// Everything that shows a photo, its captions or their votes: the list, the
// photo's page, the dashboard (counts, top captions), the votes page (caption
// text) and the poster's pages.
function revalidateMedia(generationId: number | null, userId: string | null | undefined) {
  revalidatePath("/media");
  if (generationId) revalidatePath(`/media/${generationId}`);
  revalidatePath("/");
  revalidatePath("/votes");
  revalidatePath("/users");
  if (userId) revalidatePath(`/users/${userId}`);
}

// CREATE -----------------------------------------------------------------------

// Photo in, captions out, like the main app's /create: get the captions first
// (so a Gemini failure leaves nothing behind), then store the photo and save
// the row and its captions in one transaction. The photo is posted as the
// admin, in their own Storage folder, because that's what the policies allow.
export async function createMedia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const photo = formData.get("photo");
  const vibe = formData.get("vibe");
  const location = oneLine(formData.get("location")) || null;
  const mode = formData.get("mode");

  if (!(photo instanceof File) || photo.size === 0) return fail("Please choose a photo.");
  if (!PHOTO_TYPES.includes(photo.type) || photo.size > PHOTO_MAX_BYTES) {
    return fail("Please choose a JPEG, PNG or WebP photo under 3 MB.");
  }
  if (!isVibe(vibe)) return fail("Please pick a vibe.");
  const locationError = checkLocation(location);
  if (locationError) return fail(locationError);
  if (mode !== "gemini" && mode !== "manual") return fail("Pick who writes the captions.");

  const image = Buffer.from(await photo.arrayBuffer());
  if (sniffImageType(image) !== photo.type) {
    return fail("That file isn't a JPEG, PNG or WebP photo. Please choose another.");
  }

  let captions: string[];
  let systemPrompt = MANUAL_SYSTEM_PROMPT;
  let prompt = MANUAL_PROMPT;
  let model = MANUAL_MODEL;

  if (mode === "manual") {
    // Blank boxes are fine: the form always shows a few. Errors name the box
    // as numbered on the form, so they're checked before blanks are dropped.
    const boxes = formData.getAll("caption").map(oneLine);
    for (const [index, caption] of boxes.entries()) {
      const error = caption ? checkCaption(caption) : null;
      if (error) return fail(`Caption ${index + 1}: ${error}`);
    }
    captions = boxes.filter(Boolean);
    if (captions.length === 0) return fail("Write at least one caption.");
    if (captions.length > MAX_CAPTIONS) return fail(`A photo can have at most ${MAX_CAPTIONS} captions.`);
  } else {
    try {
      const result = await generateCaptions({ image, mimeType: photo.type, vibe, location });
      ({ captions, systemPrompt, prompt, model } = result);
    } catch (error) {
      if (error instanceof CaptionError) {
        return fail(`${error.message} Nothing was saved. You can also choose “Write them myself”.`);
      }
      throw error;
    }
  }

  const supabase = await createClient();
  const path = photoPath(admin.userId, photo.type);
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, image, { contentType: photo.type, cacheControl: "31536000" });
  if (uploadError) return fail(`Upload failed: ${uploadError.message}`);

  const { data: newId, error } = await supabase.rpc("create_generation", {
    image_path: path,
    location,
    vibe,
    system_prompt: systemPrompt,
    prompt,
    model,
    captions,
  });
  if (error) {
    // Don't leave a photo in Storage that no post points to. Best effort: the
    // admin still needs to hear why saving failed.
    const { data: removed, error: removeError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove([path]);
    if (removeError || !removed?.length) {
      console.error(`Could not remove orphaned photo ${path}`, removeError ?? "");
    }
    return fail(`Could not save: ${error.message}`);
  }

  revalidateMedia(null, admin.userId);
  // The transaction went through, so the photo is saved even if the id came
  // back oddly; the list will show it.
  redirect(isId(newId) ? `/media/${newId}?created=1` : "/media");
}

// UPDATE -----------------------------------------------------------------------

// Location and vibe are the only generations columns admin.sql lets anyone
// update; the author, prompts and dates stay as they were posted.
export async function updateGeneration(
  generationId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  if (!isId(generationId)) return fail("That photo doesn't exist.");

  const vibe = formData.get("vibe");
  const location = oneLine(formData.get("location")) || null;
  if (!isVibe(vibe)) return fail("Please pick a vibe.");
  const locationError = checkLocation(location);
  if (locationError) return fail(locationError);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generations")
    .update({ location, vibe })
    .eq("id", generationId)
    .select("id, user_id");
  if (error) return fail(`Could not save: ${error.message}`);
  // RLS hides rows it won't let you change instead of raising an error.
  const row = data?.[0] as { user_id: string } | undefined;
  if (!row) return fail("That photo was not found, or you're not allowed to edit it.");

  revalidateMedia(generationId, row.user_id);
  return { status: "success", message: "Details saved." };
}

// Only the text: vote totals change through votes, never by hand.
export async function updateCaption(
  captionId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  if (!isId(captionId)) return fail("That caption doesn't exist.");

  const text = oneLine(formData.get("text"));
  const textError = checkCaption(text);
  if (textError) return fail(textError);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("captions")
    .update({ text })
    .eq("id", captionId)
    .select("id, generation_id, generations(user_id)");
  if (error) return fail(`Could not save: ${error.message}`);
  const row = data?.[0] as unknown as CaptionOwner | undefined;
  if (!row) return fail("That caption was not found, or you're not allowed to edit it.");

  revalidateMedia(row.generation_id, row.generations?.user_id);
  return { status: "success", message: "Saved." };
}

// A photo without captions has nothing to vote on, so its last caption stays.
// The whole photo can be deleted instead.
export async function deleteCaption(captionId: number): Promise<ActionState> {
  await requireAdmin();
  if (!isId(captionId)) return fail("That caption doesn't exist.");

  const supabase = await createClient();
  const { data: caption, error: readError } = await supabase
    .from("captions")
    .select("generation_id, generations(user_id)")
    .eq("id", captionId)
    .maybeSingle();
  if (readError) return fail(`Could not delete: ${readError.message}`);
  if (!caption) return fail("That caption was already deleted.");
  const { generation_id: generationId, generations: owner } = caption as unknown as CaptionOwner;

  // A HEAD request: no error body, so a missing count is the failure signal.
  const { count } = await supabase
    .from("captions")
    .select("id", { count: "exact", head: true })
    .eq("generation_id", generationId);
  if (count === null) return fail("Could not check the photo's other captions. Please try again.");
  if (count <= 1) {
    return fail("This is the photo's only caption. To remove it, delete the whole photo (Danger zone).");
  }

  // Its votes go with it (on delete cascade).
  const { data, error } = await supabase.from("captions").delete().eq("id", captionId).select("id");
  if (error) return fail(`Could not delete: ${error.message}`);
  if (!data?.length) return fail("That caption was not found, or you're not allowed to delete it.");

  revalidateMedia(generationId, owner?.user_id);
  // The message can't live in the caption's own row, which is gone after the
  // refresh, so the photo's page says it instead.
  redirect(`/media/${generationId}?captionDeleted=1`);
}

// New captions start with no votes (the column defaults) and take the first
// free position, so positions stay within the table's 1–5 check.
export async function addCaption(
  generationId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  if (!isId(generationId)) return fail("That photo doesn't exist.");

  const text = oneLine(formData.get("text"));
  const textError = checkCaption(text);
  if (textError) return fail(textError);

  const supabase = await createClient();
  const { data: generation, error: readError } = await supabase
    .from("generations")
    .select("id, user_id, captions(position)")
    .eq("id", generationId)
    .maybeSingle();
  if (readError) return fail(`Could not add the caption: ${readError.message}`);
  if (!generation) return fail("That photo was deleted.");
  const { user_id: userId, captions } = generation as {
    user_id: string;
    captions: { position: number }[] | null;
  };

  const taken = new Set((captions ?? []).map((c) => c.position));
  const position = Array.from({ length: MAX_CAPTIONS }, (_, i) => i + 1).find((p) => !taken.has(p));
  if (!position) return fail(`This photo already has ${MAX_CAPTIONS} captions, the most it can have.`);

  const { data, error } = await supabase
    .from("captions")
    .insert({ generation_id: generationId, position, text })
    .select("id");
  if (error) {
    // 23505: unique (generation_id, position). Someone else added one at the
    // same moment.
    if (error.code === "23505") return fail("Another caption just took that spot. Please try again.");
    return fail(`Could not add the caption: ${error.message}`);
  }
  if (!data?.length) return fail("You're not allowed to add captions to this photo.");

  revalidateMedia(generationId, userId);
  return { status: "success", message: "Caption added." };
}

// DELETE -----------------------------------------------------------------------

// The row first (its captions and votes cascade), then the file. In that
// order, a failure can at worst leave an unused file, never a post whose
// photo is missing.
export async function deleteGeneration(generationId: number): Promise<ActionState> {
  await requireAdmin();
  if (!isId(generationId)) return fail("That photo doesn't exist.");

  const supabase = await createClient();
  const { data: generation, error: readError } = await supabase
    .from("generations")
    .select("image_path, user_id")
    .eq("id", generationId)
    .maybeSingle();
  if (readError) return fail(`Could not delete: ${readError.message}`);
  if (!generation) return fail("That photo was already deleted.");
  const { image_path: imagePath, user_id: userId } = generation as {
    image_path: string;
    user_id: string;
  };

  const { data, error } = await supabase.from("generations").delete().eq("id", generationId).select("id");
  if (error) return fail(`Could not delete: ${error.message}`);
  if (!data?.length) return fail("That photo was not found, or you're not allowed to delete it.");

  // The memes policy only checks the folder, so through the API someone could
  // point a meme at this photo's file. Leave a file that a meme still shows.
  // HEAD requests carry no error body, so a missing count means the check
  // failed, and the file stays too.
  const { count: memesUsingIt } = await supabase
    .from("memes")
    .select("id", { count: "exact", head: true })
    .eq("image_path", imagePath);
  if (memesUsingIt === 0) {
    // remove() reports what it deleted rather than erroring, so an empty list
    // means the file was already gone or a policy hid it. The post is deleted
    // either way, so this is only worth a log line.
    const { data: removed, error: removeError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove([imagePath]);
    if (removeError || (removed?.length ?? 0) < 1) {
      console.warn(`Deleted photo ${generationId}, but not its file ${imagePath}`, removeError ?? "");
    }
  } else {
    console.warn(`Deleted photo ${generationId} and kept its file ${imagePath}: a meme may use it`);
  }

  revalidateMedia(generationId, userId);
  redirect("/media?deleted=1");
}
