import type { MetadataRoute } from "next";

import { DISALLOWED_PATHS, absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...DISALLOWED_PATHS],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
