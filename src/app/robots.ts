import type { MetadataRoute } from "next";

import { DISALLOWED_PATHS, absoluteUrl } from "@/lib/seo";

/**
 * `/robots.txt`, generated so the sitemap it points at is on the host the
 * deployment actually runs on.
 *
 * `/e/` is deliberately left crawlable: a page that must never be indexed has
 * to be reachable for its `noindex` to be read. It carries
 * `X-Robots-Tag: noindex, nofollow` from `next.config.ts` instead.
 *
 * Per request rather than baked at build, so the sitemap URL is right in a
 * deployment whose environment only exists at runtime.
 */
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
