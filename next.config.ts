import type { NextConfig } from "next";

/**
 * The gallery's small images are derived at request time, not stored: there is
 * one object per upload in the bucket and the optimiser resizes it to the tile.
 *
 * Same-origin sources (the app's own /api/media route, used when no CDN is
 * configured) need no entry here. A configured media host does, so it is read
 * from the same variable the storage driver builds URLs from - two places
 * disagreeing about the media host is a broken image on every page.
 */
function mediaPatterns() {
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  if (!base) return [];
  try {
    const { protocol, hostname, port } = new URL(base);
    return [
      {
        protocol: protocol.replace(":", "") as "http" | "https",
        hostname,
        port: port || undefined,
      },
    ];
  } catch {
    // A malformed value must not take the build down; images fall back to
    // being served unoptimised from wherever the driver points.
    console.warn("[next.config] NEXT_PUBLIC_MEDIA_BASE_URL is not a URL.");
    return [];
  }
}

/**
 * The optimiser is metered - a fixed number of transformations a month, and
 * one photograph at one width is one of them. This turns it off everywhere:
 * photographs are then served straight from the bucket, unresized.
 *
 * Worth having as a switch rather than only as a runtime fallback, because a
 * quota that runs out on the 20th takes the whole gallery's images down with
 * it. Flip this, redeploy, and the site keeps working for nothing. The stored
 * thumbnail is already a ~25 KB WebP cut for these tiles, so the wall costs
 * roughly what it did; only the full-size copies get heavier.
 */
const optimiserDisabled =
  process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION === "1" ||
  process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: optimiserDisabled,
    remotePatterns: mediaPatterns(),
    // A photo grid is the whole product, so it is worth the extra encode time:
    // AVIF runs 15-20% smaller than WebP at these sizes, and the optimiser
    // does the work once per photo rather than once per view.
    formats: ["image/avif", "image/webp"],
    // Matches the tile widths the gallery actually asks for. Without this the
    // optimiser rounds up to its own ladder and a 96px hole fetches 640px.
    imageSizes: [64, 96, 128, 192, 256, 384],
    minimumCacheTTL: 31_536_000,
  },
  // The ZIP builder and the S3 client are Node-only and pull in native-ish deps.
  serverExternalPackages: ["archiver", "@aws-sdk/lib-storage"],
  eslint: {
    // Lint is run explicitly in CI; a lint warning should not fail a deploy build.
    ignoreDuringBuilds: true,
  },
  /* The legal documents moved out from under /legal so they sit on the paths a
     payment reviewer types. Anything already printed, linked or filed keeps
     working. Permanent, because these are not coming back. */
  async redirects() {
    return [
      { source: "/legal/terms", destination: "/terms", permanent: true },
      { source: "/legal/privacy", destination: "/privacy", permanent: true },
      { source: "/legal", destination: "/terms", permanent: true },
    ];
  },
  async headers() {
    /* Applied to everything a crawler must never keep: the guest share links
       and everything the API serves. A header rather than a meta tag, because
       a meta tag only exists in HTML - it says nothing about the JPEG behind
       /api/media, which is somebody's wedding photograph and is exactly the
       thing that must not turn up in an image search.

       These paths are deliberately left crawlable in robots.txt. A disallowed
       path is never fetched, so this directive would never be read, and a URL
       that got shared somewhere public could still be listed. Letting the
       crawler in to be told "no" is the only way the "no" arrives. */
    const noIndex = {
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noarchive, noimageindex",
    };

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      { source: "/e/:path*", headers: [noIndex] },
      { source: "/api/:path*", headers: [noIndex] },
    ];
  },
};

export default nextConfig;
