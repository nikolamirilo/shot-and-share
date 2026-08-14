import type { MetadataRoute } from "next";

import { SITE } from "@/lib/seo";

/**
 * The web app manifest. "Add to home screen" is not the point - declaring the
 * name, icon and colours is, because that is what the browser chrome, the share
 * sheet and the task switcher read.
 *
 * `display: browser` on purpose: standalone would strip the address bar from a
 * page whose whole promise is that it is an ordinary link.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} - ${SITE.tagline}`,
    short_name: SITE.shortName,
    description: SITE.description,
    start_url: "/",
    display: "browser",
    background_color: "#f6f2f3",
    theme_color: "#f6f2f3",
    lang: SITE.locale,
    categories: ["photo", "events", "productivity"],
    icons: [
      {
        src: "/favicon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        type: "image/png",
        sizes: "180x180",
        purpose: "maskable",
      },
    ],
  };
}
