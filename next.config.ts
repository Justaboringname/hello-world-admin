import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // This app lives in admin/ inside the main app's repo, and both folders
  // have a package-lock.json. Without this, Next.js picks the repo root as
  // the project root and warns about the second lockfile.
  turbopack: {
    root: path.join(__dirname),
  },
  // No other site may frame the panel (clickjacking a Delete button), and
  // nothing in it should reach a search engine or another site's logs.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Photos are resized in the browser to well under 3 MB (the photos
      // bucket limit); leave room for multipart overhead. Vercel caps request
      // bodies at 4.5 MB.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
