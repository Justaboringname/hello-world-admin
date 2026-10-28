import type { ActionState } from "@/lib/action-state";

// Shared by the Server Actions of the simple record pages (terms, examples,
// LLM models and providers, sign-up rules): reading form fields, and turning
// database errors into sentences.

// What reading a form gives back: the row to save, or what to fix.
export type Parsed<T> = { ok: true; row: T } | { ok: false; error: string };

export function invalid(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export function fail(message: string): ActionState {
  return { status: "error", message };
}

export function isId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

// Form text as one tidy line.
export function oneLine(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

// Form text that may span lines: trimmed, with runs of blank lines collapsed.
export function multiLine(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() : "";
}

// An unticked checkbox isn't sent at all; a ticked one sends "on".
export function checkbox(formData: FormData, name: string): boolean | null {
  const value = formData.get(name);
  if (value === null) return false;
  return value === "on" ? true : null;
}

// A <select> of row ids. "" means none; anything else must be an id.
export function optionalId(formData: FormData, name: string): number | null | undefined {
  const value = formData.get(name);
  if (value === null || value === "") return null;
  const id = Number(value);
  return isId(id) ? id : undefined;
}

// "Keep the term to 60 characters (it's 72)."
export function tooLong(label: string, text: string, max: number) {
  return text.length > max ? `Keep the ${label} to ${max} characters (it's ${text.length}).` : null;
}

// Postgres error codes worth explaining. `what` names the row ("term",
// "domain"); `inUse` says what still points at it.
export function databaseError(
  action: "save" | "delete",
  error: { code?: string; message: string },
  { what, inUse }: { what: string; inUse?: string },
): ActionState {
  if (error.code === "23505") return fail(`That ${what} already exists.`);
  if (error.code === "23503") {
    return fail(
      action === "delete"
        ? `This ${what} is still used${inUse ? ` by ${inUse}` : ""}. Change or delete those first.`
        : `That choice no longer exists. Reload the page and try again.`,
    );
  }
  if (error.code === "23514") return fail(`That ${what} isn't in a valid format.`);
  if (error.code === "42501") return fail("You're not allowed to do that. Is supabase/week7.sql run?");
  return fail(`Could not ${action}: ${error.message}`);
}
