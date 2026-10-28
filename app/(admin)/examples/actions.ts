"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import { databaseError, fail, invalid, isId, multiLine, optionalId, tooLong, type Parsed } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";

// Public POST endpoints: requireAdmin() decides who may call them, and RLS
// plus the column grants in week7.sql decide what they can touch. Limits
// match the check constraints there.
const DESCRIPTION_MAX = 300;
const CAPTION_MAX = 200;
const NOTES_MAX = 300;

type ExampleRow = {
  chain_id: number | null;
  image_description: string;
  caption: string;
  notes: string | null;
};

function readExample(formData: FormData): Parsed<ExampleRow> {
  // null is "Any chain"; undefined is something that isn't an id at all.
  const chainId = optionalId(formData, "chain_id");
  const imageDescription = multiLine(formData, "image_description");
  const caption = multiLine(formData, "caption");
  const notes = multiLine(formData, "notes") || null;

  if (chainId === undefined) return invalid("Choose a chain from the list.");
  if (!imageDescription) return invalid("Describe the photo.");
  if (!caption) return invalid("Write the caption.");
  const error =
    tooLong("photo description", imageDescription, DESCRIPTION_MAX) ??
    tooLong("caption", caption, CAPTION_MAX) ??
    (notes ? tooLong("notes", notes, NOTES_MAX) : null);
  if (error) return invalid(error);
  return { ok: true, row: { chain_id: chainId, image_description: imageDescription, caption, notes } };
}

// Every page that shows examples.
function revalidateExamples() {
  revalidatePath("/examples");
  revalidatePath("/prompt-chains");
}

export async function createExample(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = readExample(formData);
  if (!parsed.ok) return fail(parsed.error);
  const { row } = parsed;

  const supabase = await createClient();
  const { error: dbError } = await supabase.from("ai_generation_examples").insert(row);
  if (dbError) return databaseError("save", dbError, { what: "example" });

  revalidateExamples();
  return { status: "success", message: "Added the example." };
}

export async function updateExample(
  exampleId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  if (!isId(exampleId)) return fail("That example doesn't exist.");
  const parsed = readExample(formData);
  if (!parsed.ok) return fail(parsed.error);
  const { row } = parsed;

  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("ai_generation_examples")
    .update(row)
    .eq("id", exampleId)
    .select("id");
  if (dbError) return databaseError("save", dbError, { what: "example" });
  // RLS hides rows it won't let you change instead of raising an error.
  if (!data?.length) return fail("That example was not found. It may have been deleted.");

  revalidateExamples();
  return { status: "success", message: "Saved." };
}

export async function deleteExample(exampleId: number): Promise<ActionState> {
  await requireAdmin();
  if (!isId(exampleId)) return fail("That example doesn't exist.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_generation_examples").delete().eq("id", exampleId).select("id");
  if (error) return databaseError("delete", error, { what: "example" });
  if (!data?.length) return fail("That example was not found. It may already be deleted.");

  revalidateExamples();
  return { status: "success", message: "Deleted." };
}
