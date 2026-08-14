import type { MetadataRoute } from "next";

import { PUBLIC_ROUTES, absoluteUrl } from "@/lib/seo";

/**
 * `/sitemap.xml`: only the pages a stranger is meant to arrive on. Everything
 * else is behind a sign-in or is somebody's private share link.
 *
 * `lastModified` is render time rather than a hand-kept date, and the whole
 * thing is per request, for the same reason robots.txt is.
 */
export const dynamic = "force-dynamic";
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
