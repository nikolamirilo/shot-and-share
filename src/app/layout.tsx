import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Shot & Share - every photo your guests take",
    template: "%s · Shot & Share",
  },
  description:
    "Guests scan a code and hand you their photos. No app, no account, nothing to install. Weddings, birthdays, offsites - anything with people and phones.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    siteName: "Shot & Share",
    title: "Shot & Share - every photo your guests take",
    description:
      "Guests scan a code and hand you their photos. No app, no account, nothing to install.",
  },
  twitter: { card: "summary_large_image" },
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
      </head>
      <body>{children}</body>
    </html>
  );
}
