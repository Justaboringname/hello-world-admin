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

  // The login page shows a fixed message; the reason goes to the server log.
  const fail = (message: string) => {
    // JSON-quoted: error_description comes from the URL, so it mustn't be able
    // to fake extra log lines.
    console.error(`Admin sign-in failed: ${JSON.stringify(message)}`);
    return NextResponse.redirect(new URL("/login?error=1", request.url));
  };

  if (!code) {
    return fail(searchParams.get("error_description") ?? "Missing sign-in code.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail(error.message);

  return NextResponse.redirect(new URL(next, request.url));
}
