import type { MetadataRoute } from "next";

import { SITE } from "@/lib/seo";

/**
 * The web app manifest.
 *
 * A guest meets this product by scanning a code at a table and opening it in
 * their phone's browser, so "add to home screen" is not the point - the point
 * is that the name, the icon and the colours are declared, which is what the
 * browser chrome, the share sheet and the task switcher read. Getting that
 * wrong is how a link to somebody's wedding shows up in a group chat labelled
 * `localhost`.
 *
 * `display: browser` on purpose. Standalone mode would strip the address bar
 * from a page whose whole promise is that it is an ordinary link and not an
 * app.
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
