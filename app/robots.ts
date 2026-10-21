import type { MetadataRoute } from "next";

// Nothing in the admin panel is for search engines.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
