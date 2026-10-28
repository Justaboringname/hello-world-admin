"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import { databaseError, fail, invalid, isId, oneLine, tooLong, type Parsed } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";

// Public POST endpoints: requireAdmin() decides who may call them, and RLS
// plus the column grants in week7.sql decide what they can touch. Limits and
// patterns match the check constraints there.
const DOMAIN_MAX = 253;
const EMAIL_MAX = 254;
const NOTE_MAX = 200;
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type DomainRow = { domain: string; note: string | null };
type EmailRow = { email: string; note: string | null };

// Both tables store these lowercase, so "Columbia.edu" and "columbia.edu"
// can't both exist. A leading "@" on a domain is forgiven.
function readDomain(formData: FormData): Parsed<DomainRow> {
  const domain = oneLine(formData, "domain").toLowerCase().replace(/^@/, "");
  const note = oneLine(formData, "note") || null;

  if (!domain) return invalid("Write the domain.");
  // Length first, so the pattern never runs on a huge string.
  const error =
    tooLong("domain", domain, DOMAIN_MAX) ??
    (DOMAIN_PATTERN.test(domain) ? null : "That doesn't look like a domain. Write it like columbia.edu.") ??
    (note ? tooLong("note", note, NOTE_MAX) : null);
  if (error) return invalid(error);
  return { ok: true, row: { domain, note } };
}

function readEmail(formData: FormData): Parsed<EmailRow> {
  const email = oneLine(formData, "email").toLowerCase();
  const note = oneLine(formData, "note") || null;

  if (!email) return invalid("Write the email address.");
  const error =
    tooLong("email address", email, EMAIL_MAX) ??
    (EMAIL_PATTERN.test(email) ? null : "That doesn't look like an email address. Write it like name@example.com.") ??
    (note ? tooLong("note", note, NOTE_MAX) : null);
  if (error) return invalid(error);
  return { ok: true, row: { email, note } };
}

// Allowed sign-up domains ---------------------------------------------------------

export async function createDomain(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = readDomain(formData);
  if (!parsed.ok) return fail(parsed.error);
  const { row } = parsed;

  const supabase = await createClient();
  const { error: dbError } = await supabase.from("allowed_signup_domains").insert(row);
  if (dbError) return databaseError("save", dbError, { what: "domain" });

  revalidatePath("/access");
  return { status: "success", message: `Added “${row.domain}”.` };
}

export async function updateDomain(domainId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!isId(domainId)) return fail("That domain doesn't exist.");
  const parsed = readDomain(formData);
  if (!parsed.ok) return fail(parsed.error);
  const { row } = parsed;

  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("allowed_signup_domains")
    .update(row)
    .eq("id", domainId)
    .select("id");
  if (dbError) return databaseError("save", dbError, { what: "domain" });
  // RLS hides rows it won't let you change instead of raising an error.
  if (!data?.length) return fail("That domain was not found. It may have been deleted.");

  revalidatePath("/access");
  return { status: "success", message: "Saved." };
}

export async function deleteDomain(domainId: number): Promise<ActionState> {
  await requireAdmin();
  if (!isId(domainId)) return fail("That domain doesn't exist.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("allowed_signup_domains").delete().eq("id", domainId).select("id");
  if (error) return databaseError("delete", error, { what: "domain" });
  if (!data?.length) return fail("That domain was not found. It may already be deleted.");

  revalidatePath("/access");
  return { status: "success", message: "Deleted." };
}

// Whitelisted email addresses -----------------------------------------------------

export async function createEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = readEmail(formData);
  if (!parsed.ok) return fail(parsed.error);
  const { row } = parsed;

  const supabase = await createClient();
  const { error: dbError } = await supabase.from("whitelisted_email_addresses").insert(row);
  if (dbError) return databaseError("save", dbError, { what: "email address" });

  revalidatePath("/access");
  return { status: "success", message: `Added “${row.email}”.` };
}

export async function updateEmail(emailId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!isId(emailId)) return fail("That email address doesn't exist.");
  const parsed = readEmail(formData);
  if (!parsed.ok) return fail(parsed.error);
  const { row } = parsed;

  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("whitelisted_email_addresses")
    .update(row)
    .eq("id", emailId)
    .select("id");
  if (dbError) return databaseError("save", dbError, { what: "email address" });
  if (!data?.length) return fail("That email address was not found. It may have been deleted.");

  revalidatePath("/access");
  return { status: "success", message: "Saved." };
}

export async function deleteEmail(emailId: number): Promise<ActionState> {
  await requireAdmin();
  if (!isId(emailId)) return fail("That email address doesn't exist.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("whitelisted_email_addresses").delete().eq("id", emailId).select("id");
  if (error) return databaseError("delete", error, { what: "email address" });
  if (!data?.length) return fail("That email address was not found. It may already be deleted.");

  revalidatePath("/access");
  return { status: "success", message: "Deleted." };
}
