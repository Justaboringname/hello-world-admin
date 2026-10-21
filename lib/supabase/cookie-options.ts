// The admin app never talks to Supabase from the browser, so its session
// cookies can be hidden from page scripts (HttpOnly) and sent over HTTPS only.
// Its own cookie name keeps it apart from the main app's session: cookies
// ignore ports, so on localhost the two apps would otherwise share (and
// overwrite) one cookie.
export const AUTH_COOKIE_OPTIONS = {
  name: "sb-admin-auth-token",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
} as const;
