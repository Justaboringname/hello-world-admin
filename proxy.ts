import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except Next.js's own files, the app icons and robots.txt.
    // Unlike the main app, paths ending in .png or .svg aren't skipped: the
    // panel has no public images, and /media/1.png must hit the wall too.
    "/((?!_next/static|_next/image|(?:favicon\\.ico|icon\\.svg|apple-icon\\.png|robots\\.txt)$).*)",
  ],
};
