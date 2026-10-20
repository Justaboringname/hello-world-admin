"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import { MEME_TEXT_MAX_LENGTH, MEME_TITLE_MAX_LENGTH, PHOTO_BUCKET } from "@/lib/captions";
import { createClient } from "@/lib/supabase/server";

// Both actions are public POST endpoints. requireAdmin() decides who may call
// them, RLS and the column grants in admin.sql decide what they can touch,
// and the meme id is checked again because bound arguments come from the
// browser.

type Supabase = Awaited<ReturnType<typeof createClient>>;

function fail(message: string): ActionState {
  return { status: "error", message };
}

function isId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

// Form text as one tidy line, the way the main app saves memes.
function oneLine(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

// Everything that shows a meme's title, text or votes: the lists, its page,
// the votes page (labels), the dashboard (top memes) and the poster's page.
function revalidateMeme(memeId: number, userId: string | null) {
  revalidatePath("/memes");
  revalidatePath(`/memes/${memeId}`);
  revalidatePath("/votes");
  revalidatePath("/");
  revalidatePath("/users");
  if (userId) revalidatePath(`/users/${userId}`);
}

// UPDATE -----------------------------------------------------------------------

// Title, top and bottom text, and members-only: the only memes columns
// admin.sql lets anyone update. Votes, the author and the image stay as
// they were posted.
export async function updateMeme(
  memeId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  if (!isId(memeId)) return fail("That meme doesn't exist.");

  const title = oneLine(formData.get("title"));
  const topText = oneLine(formData.get("top_text")) || null;
  const bottomText = oneLine(formData.get("bottom_text")) || null;
  // An unticked checkbox isn't sent at all; a ticked one sends "on".
  const membersOnlyField = formData.get("members_only");
  if (membersOnlyField !== null && membersOnlyField !== "on") return fail("Members only is a yes or no.");
  const membersOnly = membersOnlyField === "on";

  // Same limits as the memes_text_lengths check in meme_votes.sql.
  if (!title) return fail("Give the meme a title.");
  if (title.length > MEME_TITLE_MAX_LENGTH) {
    return fail(`Keep the title to ${MEME_TITLE_MAX_LENGTH} characters (it's ${title.length}).`);
  }
  for (const [label, text] of [
    ["top", topText],
    ["bottom", bottomText],
  ] as const) {
    if (text && text.length > MEME_TEXT_MAX_LENGTH) {
      return fail(`Keep the ${label} text to ${MEME_TEXT_MAX_LENGTH} characters (it's ${text.length}).`);
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memes")
    .update({ title, top_text: topText, bottom_text: bottomText, members_only: membersOnly })
    .eq("id", memeId)
    .select("id, user_id");
  if (error) return fail(`Could not save: ${error.message}`);
  // RLS hides rows it won't let you change instead of raising an error.
  const row = data?.[0] as { user_id: string | null } | undefined;
  if (!row) return fail("That meme was not found, or you're not allowed to edit it.");

  revalidateMeme(memeId, row.user_id);
  return { status: "success", message: "Meme saved." };
}

// DELETE -----------------------------------------------------------------------

// Its votes go with it (meme_votes cascades). An uploaded image is removed
// from Storage afterwards; the seeded classics live on imgflip, so there's
// nothing of ours to remove for them.
export async function deleteMeme(memeId: number): Promise<ActionState> {
  await requireAdmin();
  if (!isId(memeId)) return fail("That meme doesn't exist.");

  const supabase = await createClient();
  // Read the image path first: once the row is gone, so is the path.
  const { data: meme, error: readError } = await supabase
    .from("memes")
    .select("id, image_path, user_id")
    .eq("id", memeId)
    .maybeSingle();
  if (readError) return fail(`Could not delete: ${readError.message}`);
  if (!meme) return fail("That meme was not found. It may already be deleted.");

  const { data: deleted, error } = await supabase.from("memes").delete().eq("id", memeId).select("id");
  if (error) return fail(`Could not delete: ${error.message}`);
  if (!deleted?.length) return fail("That meme was not found, or you're not allowed to delete it.");

  const { image_path: imagePath, user_id: userId } = meme as {
    image_path: string | null;
    user_id: string | null;
  };
  if (imagePath) await removeImage(supabase, imagePath);

  revalidateMeme(memeId, userId);
  redirect("/memes?deleted=1");
}

// Best effort: the meme is already deleted, so a leftover file is only
// clutter, not a reason to tell the admin it failed.
async function removeImage(supabase: Supabase, path: string) {
  try {
    // The memes policy only checks the folder, so through the API someone
    // could point a meme at one of their AI photos. Leave a file that a
    // photo still shows alone.
    const { count, error: countError } = await supabase
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("image_path", path);
    if (count) return;
    // HEAD requests carry no error body, so a missing count is the failure.
    if (countError || count === null) {
      console.error(`Kept meme image ${path}: couldn't check whether a photo uses it`, countError ?? "");
      return;
    }

    // remove() reports a file it couldn't see or delete as an empty list,
    // not as an error.
    const { data: removed, error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    if (error || removed?.length !== 1) {
      console.error(`Could not remove meme image ${path}`, error ?? "");
    }
  } catch (error) {
    console.error(`Could not remove meme image ${path}`, error);
  }
}
