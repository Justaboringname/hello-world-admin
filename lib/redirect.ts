// Where to send the admin after Google sign-in. Supabase must redirect to
// exactly /auth/callback (no query string), so the destination rides along in
// a short-lived cookie instead. Named apart from the main app's cookie, since
// both apps share cookies on localhost.
export const NEXT_PATH_COOKIE = "admin_post_auth_next";

const SAME_ORIGIN = "http://same-origin.invalid";

// Only allow same-origin paths, so ?next= cannot become an open redirect.
// Checking the string isn't enough: URL parsing drops tabs and newlines, so
// "/\t/evil.example" turns into "//evil.example", and "/..//evil.example"
// normalizes to it. Control characters and backslashes are refused outright,
// and what's returned is the normalized path, checked again.
export function safeNextPath(value: unknown, fallback = "/") {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }
  try {
    const url = new URL(value, SAME_ORIGIN);
    const path = url.pathname + url.search + url.hash;
    return url.origin === SAME_ORIGIN && !path.startsWith("//") ? path : fallback;
  } catch {
    return fallback;
  }
}

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
