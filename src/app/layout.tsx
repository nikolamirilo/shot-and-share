import type { Metadata, Viewport } from "next";

import { JsonLd } from "@/components/seo/JsonLd";
import { env } from "@/lib/env";
import {
  SITE,
  graph,
  organisationSchema,
  siteUrl,
  websiteSchema,
} from "@/lib/seo";

import "./globals.css";

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
  alternates: { canonical: "/" },
  /* Safari turns anything shaped like a phone number into a call link. */
  formatDetection: { telephone: false, address: false, email: false },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
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
        <JsonLd
          id="ld-site"
          json={graph(organisationSchema(), websiteSchema())}
        />
      </head>
      {/* Extensions write attributes onto <body> before React hydrates. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
