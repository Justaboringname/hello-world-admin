import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Admin = {
  userId: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
};

export type AdminCheck =
  | { status: "signed-out" }
  // setupNeeded: admin.sql hasn't been run yet, so is_superadmin() is missing.
  | { status: "not-admin"; email: string | null; setupNeeded: boolean }
  | { status: "admin"; admin: Admin };

// Who is asking, and are they a superadmin? The database decides, through
// is_superadmin() in supabase/admin.sql. Cached per request so the layout, the
// page and the header share one lookup.
export const checkAdmin = cache(async (): Promise<AdminCheck> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return { status: "signed-out" };

  const email = typeof claims.email === "string" ? claims.email : null;
  const { data: isAdmin, error } = await supabase.rpc("is_superadmin");
  if (error || isAdmin !== true) {
    // PGRST202: PostgREST can't find the function.
    return { status: "not-admin", email, setupNeeded: error?.code === "PGRST202" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url")
    .eq("id", claims.sub)
    .maybeSingle();

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    email ||
    "Admin";

  return {
    status: "admin",
    admin: {
      userId: claims.sub,
      email,
      name,
      avatarUrl: profile?.avatar_url ?? null,
    },
  };
});

// The gate for every admin page and every Server Action. proxy.ts redirects
// first, but pages and actions must not trust that alone: a Server Action is
// a public POST endpoint, and layouts don't re-run on client navigation.
export async function requireAdmin(currentPath = "/"): Promise<Admin> {
  const check = await checkAdmin();
  if (check.status === "signed-out") {
    redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  }
  if (check.status !== "admin") redirect("/denied");
  return check.admin;
}
