import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in admin/ inside the main app's repo, and both folders
  // have a package-lock.json. Without this, Next.js picks the repo root as
  // the project root and warns about the second lockfile.
  turbopack: {
    root: path.join(__dirname),
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
