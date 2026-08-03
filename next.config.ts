import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The ZIP builder and the S3 client are Node-only and pull in native-ish deps.
  serverExternalPackages: ["archiver", "@aws-sdk/lib-storage"],
  eslint: {
    // Lint is run explicitly in CI; a lint warning should not fail a deploy build.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
