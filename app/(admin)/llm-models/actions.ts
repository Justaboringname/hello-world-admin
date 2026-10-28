"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import {
  checkbox,
  databaseError,
  fail,
  invalid,
  isId,
  oneLine,
  optionalId,
  tooLong,
  type Parsed,
} from "@/lib/records";
import { createClient } from "@/lib/supabase/server";

// Public POST endpoints: requireAdmin() decides who may call them, and RLS
// plus the column grants in week7.sql decide what they can touch. Limits
// match the check constraints there.
const NAME_MAX = 80;
const API_MODEL_ID_MAX = 100;
// Model ids are plain, like gemini-3.5-flash-lite or models/gemini-pro:latest.
const API_MODEL_ID_PATTERN = /^[A-Za-z0-9._:/-]+$/;

// Exactly the columns week7.sql lets the panel insert and update.
type ModelRow = {
  provider_id: number;
  name: string;
  api_model_id: string;
  supports_temperature: boolean;
  is_active: boolean;
};

function readModel(formData: FormData): Parsed<ModelRow> {
  const providerId = optionalId(formData, "provider_id");
  const name = oneLine(formData, "name");
  const apiModelId = oneLine(formData, "api_model_id");
  const supportsTemperature = checkbox(formData, "supports_temperature");
  const isActive = checkbox(formData, "is_active");

  if (providerId === undefined) return invalid("That provider doesn't exist. Reload the page and try again.");
  if (providerId === null) return invalid("Choose a provider.");
  if (!name) return invalid("Name the model.");
  if (!apiModelId) return invalid("Write the API model id.");
  const error = tooLong("name", name, NAME_MAX) ?? tooLong("API model id", apiModelId, API_MODEL_ID_MAX);
  if (error) return invalid(error);
  if (!API_MODEL_ID_PATTERN.test(apiModelId)) {
    return invalid("The API model id can only use letters, numbers and . _ : / -");
  }
  if (supportsTemperature === null || isActive === null) return invalid("Those checkboxes are a yes or no.");
  return {
    ok: true,
    row: {
      provider_id: providerId,
      name,
      api_model_id: apiModelId,
      supports_temperature: supportsTemperature,
      is_active: isActive,
    },
  };
}

// Every page that shows models: this one, the providers (a count each) and
// the prompt chains (each step's model).
function revalidateModels() {
  revalidatePath("/llm-models");
  revalidatePath("/llm-providers");
  revalidatePath("/prompt-chains");
}

export async function createModel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = readModel(formData);
  if (!parsed.ok) return fail(parsed.error);
  const { row } = parsed;

  const supabase = await createClient();
  const { error: dbError } = await supabase.from("llm_models").insert(row);
  if (dbError) return databaseError("save", dbError, { what: "model" });

  revalidateModels();
  return { status: "success", message: `Added “${row.name}”.` };
}

export async function updateModel(modelId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!isId(modelId)) return fail("That model doesn't exist.");
  const parsed = readModel(formData);
  if (!parsed.ok) return fail(parsed.error);
  const { row } = parsed;

  const supabase = await createClient();
  const { data, error: dbError } = await supabase.from("llm_models").update(row).eq("id", modelId).select("id");
  if (dbError) return databaseError("save", dbError, { what: "model" });
  // RLS hides rows it won't let you change instead of raising an error.
  if (!data?.length) return fail("That model was not found. It may have been deleted.");

  revalidateModels();
  return { status: "success", message: "Saved." };
}

// Prompt chain steps that used the model keep their place, with no model
// (on delete set null).
export async function deleteModel(modelId: number): Promise<ActionState> {
  await requireAdmin();
  if (!isId(modelId)) return fail("That model doesn't exist.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("llm_models").delete().eq("id", modelId).select("id");
  if (error) return databaseError("delete", error, { what: "model" });
  if (!data?.length) return fail("That model was not found. It may already be deleted.");

  revalidateModels();
  return { status: "success", message: "Deleted." };
}
