"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import { parseId } from "@/lib/format";
import { databaseError, fail, invalid, type Parsed } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";

// A public POST endpoint: requireAdmin() decides who may call it, and RLS plus
// the column grants in week7.sql decide what it can touch. Chains and steps
// are read only; in the mix, only the weight can change. The limit matches
// the check constraint there.
const WEIGHT_MAX = 100;
// There are a handful of chains. A form with far more fields than that wasn't
// sent by the page.
const MAX_WEIGHTS = 50;

// "weight-3" is chain 3's weight. The id comes from the browser, so it's
// checked like any other input.
const WEIGHT_FIELD = /^weight-(.*)$/;

type Weight = { chainId: number; weight: number };

function readWeights(formData: FormData): Parsed<Weight[]> {
  const weights: Weight[] = [];
  const seen = new Set<number>();

  for (const [key, value] of formData) {
    const match = WEIGHT_FIELD.exec(key);
    if (!match) continue;
    const chainId = parseId(match[1]);
    if (!chainId) return invalid("That chain doesn't exist. Reload the page and try again.");
    if (seen.has(chainId)) return invalid("Each chain can only have one weight.");
    seen.add(chainId);

    // Number("") is 0, so check the text itself first.
    const text = typeof value === "string" ? value.trim() : "";
    if (!/^\d{1,3}$/.test(text) || Number(text) > WEIGHT_MAX) {
      return invalid(`Give every chain a whole number from 0 to ${WEIGHT_MAX}.`);
    }
    weights.push({ chainId, weight: Number(text) });
  }

  if (!weights.length) return invalid("There were no weights to save.");
  if (weights.length > MAX_WEIGHTS) return invalid("That's more weights than there are chains.");
  if (!weights.some((entry) => entry.weight > 0)) {
    return invalid("Give at least one chain a weight above 0, or none of them would ever be picked.");
  }
  return { ok: true, row: weights };
}

export async function updateMix(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = readWeights(formData);
  if (!parsed.ok) return fail(parsed.error);
  const weights = parsed.row;

  const supabase = await createClient();
  // One update per chain, sending only the weight: there's no insert grant,
  // so no upsert, and the updated_at trigger keeps the time. Without a
  // transaction they can't all fail together, so they go one at a time,
  // heaviest first, and stop at the first failure: the first write always
  // sets a weight above 0, so a later failure can't leave a mix of all zeros.
  const ordered = [...weights].sort((a, b) => b.weight - a.weight);
  let saved = 0;
  let reason: string | null = null;
  for (const { chainId, weight } of ordered) {
    const { data, error } = await supabase
      .from("prompt_chain_mix")
      .update({ weight })
      .eq("chain_id", chainId)
      .select("chain_id");
    if (error) {
      reason = databaseError("save", error, { what: "weight" }).message ?? "Could not save.";
      break;
    }
    // RLS hides rows it won't let you change instead of raising an error.
    if (!data?.length) {
      reason = "A chain in the mix was not found. It may have been deleted.";
      break;
    }
    saved += 1;
  }
  // Some may have saved even if a later one failed, so refresh either way.
  revalidatePath("/prompt-chains");

  if (!reason) return { status: "success", message: "Saved." };
  if (!saved) return fail(reason);
  return fail(`Only ${saved} of ${ordered.length} weights saved. ${reason}`);
}
