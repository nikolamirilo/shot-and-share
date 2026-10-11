import type { NextConfig } from "next";

/**
 * The gallery's small images are derived at request time: one object per upload in the
 * bucket, resized by the optimiser.
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
    // A malformed value must not take the build down; images fall back to being served
    // unoptimised from wherever the driver points.
    console.warn("[next.config] NEXT_PUBLIC_MEDIA_BASE_URL is not a URL.");
    return [];
  }
}

/**
 * The optimiser is metered - one photograph at one width is one transformation - so it
 * can be switched off entirely.
 */
const optimiserDisabled =
  process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION === "1" ||
  process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: optimiserDisabled,
    remotePatterns: mediaPatterns(),
    // AVIF runs 15-20% smaller than WebP at these sizes, and the optimiser does the
    // work once per photo rather than once per view.
    formats: ["image/avif", "image/webp"],
    // Matches the tile widths the gallery actually asks for. Without this the optimiser
    // rounds up to its own ladder and a 96px hole fetches 640px.
    imageSizes: [64, 96, 128, 192, 256, 384],
    /**
     * Thirty days, not a year: a year is right for an object that is never rewritten
     * and wrong for a resize the optimiser may be asked to stop producing.
     */
    minimumCacheTTL: 2_592_000,
  },
  // The ZIP builder and the S3 client are Node-only and pull in native-ish deps.
  serverExternalPackages: ["archiver", "@aws-sdk/lib-storage"],
  eslint: {
    // Lint is run explicitly in CI; a lint warning should not fail a deploy build.
    ignoreDuringBuilds: true,
  },
  /* The legal documents moved out from under /legal, so the old paths redirect. */
  async redirects() {
    return [
      { source: "/legal/terms", destination: "/terms", permanent: true },
      { source: "/legal/privacy", destination: "/privacy", permanent: true },
      { source: "/legal", destination: "/terms", permanent: true },
    ];
  },
  async headers() {
    /*
     * Applied to everything a crawler must never keep: the guest share links and
     * everything the API serves.
     */
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
