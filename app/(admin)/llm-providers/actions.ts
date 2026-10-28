"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import { databaseError, fail, invalid, isId, oneLine, tooLong, type Parsed } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";

// Public POST endpoints: requireAdmin() decides who may call them, and RLS
// plus the column grants in week7.sql decide what they can touch. Limits
// match the check constraints there.
const NAME_MAX = 60;
const WEBSITE_MAX = 200;

type ProviderRow = { name: string; website: string | null };

// The website becomes a link on the page, so it has to be a real https
// address, not just text that starts like one.
function isWebsite(text: string) {
  if (!text.startsWith("https://") || /\s/.test(text)) return false;
  try {
    return new URL(text).hostname !== "";
  } catch {
    return false;
  }
}

function readProvider(formData: FormData): Parsed<ProviderRow> {
  const name = oneLine(formData, "name");
  const website = oneLine(formData, "website") || null;

  if (!name) return invalid("Write the provider's name.");
  const error =
    tooLong("name", name, NAME_MAX) ?? (website ? tooLong("website", website, WEBSITE_MAX) : null);
  if (error) return invalid(error);
  if (website && !isWebsite(website)) return invalid("Write the website as a full address starting with https://.");
  return { ok: true, row: { name, website } };
}

// Every page that names a provider: this one, the models (a badge each) and
// the prompt chains (each step's model).
function revalidateProviders() {
  revalidatePath("/llm-providers");
  revalidatePath("/llm-models");
  revalidatePath("/prompt-chains");
}

export async function createProvider(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = readProvider(formData);
  if (!parsed.ok) return fail(parsed.error);
  const { row } = parsed;

  const supabase = await createClient();
  const { error: dbError } = await supabase.from("llm_providers").insert(row);
  if (dbError) return databaseError("save", dbError, { what: "provider" });

  revalidateProviders();
  return { status: "success", message: `Added “${row.name}”.` };
}

export async function updateProvider(
  providerId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  if (!isId(providerId)) return fail("That provider doesn't exist.");
  const parsed = readProvider(formData);
  if (!parsed.ok) return fail(parsed.error);
  const { row } = parsed;

  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("llm_providers")
    .update(row)
    .eq("id", providerId)
    .select("id");
  if (dbError) return databaseError("save", dbError, { what: "provider" });
  // RLS hides rows it won't let you change instead of raising an error.
  if (!data?.length) return fail("That provider was not found. It may have been deleted.");

  revalidateProviders();
  return { status: "success", message: "Saved." };
}

// A provider with models can't go (on delete restrict): its models have to
// move to another provider or be deleted first.
export async function deleteProvider(providerId: number): Promise<ActionState> {
  await requireAdmin();
  if (!isId(providerId)) return fail("That provider doesn't exist.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("llm_providers").delete().eq("id", providerId).select("id");
  if (error) return databaseError("delete", error, { what: "provider", inUse: "its LLM models" });
  if (!data?.length) return fail("That provider was not found. It may already be deleted.");

  revalidateProviders();
  return { status: "success", message: "Deleted." };
}
