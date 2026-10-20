import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { NEXT_PATH_COOKIE, safeNextPath } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

// Google -> Supabase -> here with ?code=. Exchange it for a session cookie,
// then go where the admin was headed. proxy.ts decides whether they get in.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");

  const cookieStore = await cookies();
  const next = safeNextPath(cookieStore.get(NEXT_PATH_COOKIE)?.value);
  cookieStore.delete(NEXT_PATH_COOKIE);

  const fail = (message: string) =>
    NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.url),
    );

  if (!code) {
    return fail(searchParams.get("error_description") ?? "Missing sign-in code.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail(error.message);

  return NextResponse.redirect(new URL(next, request.url));
}
