"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import { databaseError, fail, invalid, isId, multiLine, oneLine, tooLong, type Parsed } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";

// Public POST endpoints: requireAdmin() decides who may call them, and RLS
// plus the column grants in week7.sql decide what they can touch. Limits
// match the check constraints there.
const TERM_MAX = 60;
const DEFINITION_MAX = 500;
const EXAMPLE_MAX = 300;

type TermRow = { term: string; definition: string; example: string | null };

function readTerm(formData: FormData): Parsed<TermRow> {
  const term = oneLine(formData, "term");
  const definition = multiLine(formData, "definition");
  const example = multiLine(formData, "example") || null;

  if (!term) return invalid("Write the term.");
  if (!definition) return invalid("Say what it means.");
  const error =
    tooLong("term", term, TERM_MAX) ??
    tooLong("definition", definition, DEFINITION_MAX) ??
    (example ? tooLong("example", example, EXAMPLE_MAX) : null);
  if (error) return invalid(error);
  return { ok: true, row: { term, definition, example } };
}

export async function createTerm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = readTerm(formData);
  if (!parsed.ok) return fail(parsed.error);
  const { row } = parsed;

  const supabase = await createClient();
  const { error: dbError } = await supabase.from("terms").insert(row);
  if (dbError) return databaseError("save", dbError, { what: "term" });

  revalidatePath("/terms");
  return { status: "success", message: `Added “${row.term}”.` };
}

export async function updateTerm(termId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!isId(termId)) return fail("That term doesn't exist.");
  const parsed = readTerm(formData);
  if (!parsed.ok) return fail(parsed.error);
  const { row } = parsed;

  const supabase = await createClient();
  const { data, error: dbError } = await supabase.from("terms").update(row).eq("id", termId).select("id");
  if (dbError) return databaseError("save", dbError, { what: "term" });
  // RLS hides rows it won't let you change instead of raising an error.
  if (!data?.length) return fail("That term was not found. It may have been deleted.");

  revalidatePath("/terms");
  return { status: "success", message: "Saved." };
}

export async function deleteTerm(termId: number): Promise<ActionState> {
  await requireAdmin();
  if (!isId(termId)) return fail("That term doesn't exist.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("terms").delete().eq("id", termId).select("id");
  if (error) return databaseError("delete", error, { what: "term" });
  if (!data?.length) return fail("That term was not found. It may already be deleted.");

  revalidatePath("/terms");
  return { status: "success", message: "Deleted." };
}
