import type { MetadataRoute } from "next";

import { DISALLOWED_PATHS, absoluteUrl } from "@/lib/seo";

/**
 * `/robots.txt`, generated rather than written by hand so the sitemap it points
 * at is always on the host the deployment actually runs on.
 *
 * What is *not* here matters as much as what is. `/e/` - the guest share links
 * - is deliberately left crawlable, because a page that must never be indexed
 * has to be reachable for its `noindex` to be read. Blocking it here would mean
 * the directive is never seen and a shared link could still surface as a bare
 * URL. It carries `X-Robots-Tag: noindex, nofollow` instead, set in
 * `next.config.ts` so it applies to every response from that path and not only
 * to the HTML.
 *
 * Rendered per request rather than baked at build. It costs nothing - this is
 * six lines of text served a handful of times a day - and it means the sitemap
 * URL is correct even in a deployment where the environment is only present at
 * runtime, rather than frozen as `localhost:3000` by a build that had not been
 * told where it was going.
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
