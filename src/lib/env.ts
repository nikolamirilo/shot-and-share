import "server-only";

import {
  SUPABASE_PUBLISHABLE_KEY,
  hasSupabase,
} from "@/lib/supabase/config";

function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export function required(name: string): string {
  const v = opt(name);
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return v;
}

export const env = {
  get siteUrl(): string {
    return (
      opt("NEXT_PUBLIC_SITE_URL") ??
      (opt("VERCEL_PROJECT_PRODUCTION_URL")
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000")
    );
  },

  seo: {
    get googleVerification() {
      return opt("GOOGLE_SITE_VERIFICATION");
    },
    get bingVerification() {
      return opt("BING_SITE_VERIFICATION");
    },
  },

  supabase: {
    get url() {
      return opt("NEXT_PUBLIC_SUPABASE_URL");
    },
    get publishableKey() {
      return SUPABASE_PUBLISHABLE_KEY;
    },
    get secretKey() {
      return (
        opt("SUPABASE_SECRET_KEY") ??
        opt("SUPABASE_SERVICE_ROLE_KEY")
      );
    },
  },

  s3: {
    get bucket() {
      return opt("S3_BUCKET");
    },
    get region() {
      return opt("S3_REGION") ?? "eu-central-1";
    },
    get accessKeyId() {
      return opt("S3_ACCESS_KEY_ID");
    },
    get secretAccessKey() {
      return opt("S3_SECRET_ACCESS_KEY");
    },
    get endpoint() {
      return opt("S3_ENDPOINT");
    },
  },

  get mediaBaseUrl() {
    return opt("NEXT_PUBLIC_MEDIA_BASE_URL");
  },

  cdn: {
    get provider(): "cloudfront" | "bunny" | undefined {
      const value = opt("CDN_PROVIDER");
      return value === "cloudfront" || value === "bunny" ? value : undefined;
    },
    get distributionId() {
      return opt("CDN_DISTRIBUTION_ID");
    },
    get apiKey() {
      return opt("CDN_API_KEY");
    },
  },

  creem: {
    get apiKey() {
      return opt("CREEM_API_KEY");
    },
    get webhookSecret() {
      return opt("CREEM_WEBHOOK_SECRET");
    },
    get apiBase() {
      return opt("CREEM_API_KEY")?.startsWith("creem_test_")
        ? "https://test-api.creem.io"
        : "https://api.creem.io";
    },
    get isTestMode() {
      return Boolean(opt("CREEM_API_KEY")?.startsWith("creem_test_"));
    },
  },

  get resendApiKey() {
    return opt("RESEND_API_KEY");
  },
  get emailFrom() {
    return opt("EMAIL_FROM") ?? "Shot & Share <office@reactify-solutions.com>";
  },

  get cronSecret() {
    return opt("CRON_SECRET");
  },

  get moderationProvider(): "rekognition" | "none" {
    return opt("MODERATION_PROVIDER") === "rekognition" ? "rekognition" : "none";
  },

  get mockCheckout() {
    return opt("ENABLE_MOCK_CHECKOUT") === "1";
  },

  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};
    
export { hasSupabase };

export const hasS3 = Boolean(
  process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY,
);

export function hasCreem(): boolean {
  return Boolean(env.creem.apiKey);
}
