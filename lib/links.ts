// The public app, for "View in app" links next to photos and memes. Optional:
// without NEXT_PUBLIC_MAIN_APP_URL the links are simply left out.
export function mainAppUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_MAIN_APP_URL?.trim().replace(/\/+$/, "");
  return base ? `${base}${path}` : null;
}
