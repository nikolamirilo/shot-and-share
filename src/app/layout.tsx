import type { Metadata, Viewport } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { env } from "@/lib/env";
import {
  SITE,
  graph,
  organisationSchema,
  siteUrl,
  websiteSchema,
} from "@/lib/seo";

import "./globals.css";

/**
 * Everything below is inherited by every page and overridden per route where it
 * needs to be.
 *
 * `metadataBase` comes from the environment rather than a literal: it is what
 * every canonical, every Open Graph URL and every image path is resolved
 * against, so hard-coding production here would have preview deployments
 * declaring themselves canonical for the live site - the fastest way to get the
 * real one dropped from the index.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE.name} - every photo your guests take`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.name, url: siteUrl() }],
  creator: SITE.name,
  publisher: SITE.name,
  category: "technology",
  /* Every page states its own canonical; this is the default for anything that
     forgets to, and it is the site root rather than a guess at the path. */
  alternates: { canonical: "/" },
  /* Safari turns anything shaped like a phone number into a call link, which on
     a page full of storage figures and photo counts is a link to nowhere. */
  formatDetection: { telephone: false, address: false, email: false },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      /* The default is a 160-ish character clip and a thumbnail. A product
         whose result is worth reading in full, with the social card as the
         preview, wants both lifted. */
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "en_GB",
    url: "/",
    title: `${SITE.name} - every photo your guests take`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} - every photo your guests take`,
    description: SITE.description,
  },
  /* Console verification tokens, when the deployment has them. Absent in
     development and in previews, which is correct: verifying a preview host
     tells a search console about a site nobody should be looking at. */
  verification: {
    google: env.seo.googleVerification,
    other: env.seo.bingVerification
      ? { "msvalidate.01": env.seo.bingVerification }
      : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: "#F6F2F3",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Azeret+Mono:wght@400;500&family=Instrument+Sans:wght@400..700&display=swap"
          rel="stylesheet"
        />
        {/* Who publishes this and what the site is, once, at the root. Pages
            add their own nodes and point back at these by @id rather than
            restating them. */}
        <JsonLd
          id="ld-site"
          json={graph(organisationSchema(), websiteSchema())}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
