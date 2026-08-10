import type { MetadataRoute } from "next";

import { PUBLIC_ROUTES, absoluteUrl } from "@/lib/seo";

/**
 * `/sitemap.xml`.
 *
 * Only the four pages a stranger is meant to arrive on. Every other route in
 * the product is either behind a sign-in or is somebody's private share link,
 * and listing those would be handing a crawler a map of pages it is being told
 * elsewhere not to index.
 *
 * `lastModified` is the render time rather than a hand-kept date. A stale date
 * is a lie a crawler learns to ignore, and a marketing page genuinely does
 * change whenever the site is redeployed.
 *
 * Per request, for the same reason robots.txt is: a sitemap full of
 * `localhost:3000` is the classic result of a build that did not know its own
 * hostname yet.
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
