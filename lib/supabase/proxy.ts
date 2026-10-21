import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options";
import { supabaseEnv } from "./env";

// The only pages a visitor can open without being a superadmin: signing in,
// the OAuth redirect, and the "this account isn't an admin" page. Every other
// route, including ones added later, is behind the wall by default.
const PUBLIC_PATHS = ["/login", "/auth/callback", "/denied"];

// Exact matches: /login/anything isn't a page, and shouldn't be let through
// as if it were one.
function isPublic(pathname: string) {
  return PUBLIC_PATHS.includes(pathname);
}

export async function updateSession(request: NextRequest) {
  const { url, anonKey } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Must run before any response is produced so a refreshed token is saved.
  const { data } = await supabase.auth.getClaims();
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return response;

  // Redirects keep any refreshed session cookies.
  const redirectTo = (target: URL) => {
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!data?.claims) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    return redirectTo(loginUrl);
  }

  // Signed in isn't enough: the database has to say this user is a
  // superadmin. Pages and Server Actions check again, and the RLS policies in
  // supabase/admin.sql check a third time. Link prefetches (dozens on a list
  // page) skip this round trip, since the page they fetch checks before it
  // renders anything.
  if (request.headers.has("next-router-prefetch")) return response;
  const { data: isAdmin, error } = await supabase.rpc("is_superadmin");
  // An outage isn't a "no": let the page check again and show its error
  // instead of telling a real admin they aren't one. PGRST202 means
  // admin.sql hasn't been run, which /denied explains.
  if (error && error.code !== "PGRST202") return response;
  if (isAdmin !== true) {
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = "/denied";
    deniedUrl.search = "";
    return redirectTo(deniedUrl);
  }

  return response;
}
