import "server-only";
import { fullName } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";

// Who a ?user= filter is about, for its chip: their profile name, or their
// Google email when they never added one, so the admin can tell who it is.
export async function userLabel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data } = await supabase
    .rpc("admin_users")
    .select("id, first_name, last_name, email")
    .eq("id", userId)
    .maybeSingle<{ first_name: string | null; last_name: string | null; email: string | null }>();
  return fullName(data) || data?.email || null;
}
