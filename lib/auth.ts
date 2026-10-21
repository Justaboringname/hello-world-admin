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
// is_superadmin() in supabase/admin.sql. Cached per request so the layout,
// the page and the sidebar share one lookup.
export const checkAdmin = cache(async (): Promise<AdminCheck> => {
  const supabase = await createClient();
  // getUser() asks Supabase Auth rather than only checking the token's
  // signature (getClaims), so a session that was signed out elsewhere stops
  // working right away instead of when its token expires. Worth one extra
  // request in an app that can delete anyone's posts.
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { status: "signed-out" };

  const email = user.email ?? null;
  // Both at once; the profile only matters if the answer is yes.
  const [{ data: isAdmin, error }, { data: profile }] = await Promise.all([
    supabase.rpc("is_superadmin"),
    supabase
      .from("profiles")
      .select("first_name, last_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  // PGRST202: PostgREST can't find the function, so admin.sql hasn't run.
  if (error?.code === "PGRST202") return { status: "not-admin", email, setupNeeded: true };
  // Anything else is an outage, not a verdict: fail closed, and let the error
  // page say so rather than telling a real admin they aren't one.
  if (error) throw new Error(`Couldn't check admin access: ${error.message}`);
  if (isAdmin !== true) return { status: "not-admin", email, setupNeeded: false };

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    email ||
    "Admin";

  return {
    status: "admin",
    admin: {
      userId: user.id,
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
