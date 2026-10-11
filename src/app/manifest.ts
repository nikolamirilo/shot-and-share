import type { MetadataRoute } from "next";

import { SITE } from "@/lib/seo";

/** `display: browser` on purpose: standalone would strip the address bar. */
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
