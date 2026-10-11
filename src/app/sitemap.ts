import type { MetadataRoute } from "next";

import { PUBLIC_ROUTES, absoluteUrl } from "@/lib/seo";

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
