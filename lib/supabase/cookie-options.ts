// The admin app never talks to Supabase from the browser, so its session
// cookies can be hidden from page scripts (HttpOnly) and sent over HTTPS only.
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
} as const;
