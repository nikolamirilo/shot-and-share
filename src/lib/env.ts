import "server-only";

import {
  SUPABASE_PUBLISHABLE_KEY,
  hasSupabase,
} from "@/lib/supabase/config";

/**
 * Environment access in one place, so that "is S3 configured?" is a question
 * with a single answer rather than five scattered truthiness checks.
 *
 * Every field is a getter. Reading `process.env` once at import time looks
 * tidier and is a trap: the value gets frozen into the module the first time
 * anything imports it, which makes the code untestable and hides late-bound
 * configuration. Getters cost nothing and always tell the truth.
 */

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

  /**
   * A separate hostname from the app from day one, so moving media from
   * Cloudflare to CloudFront is a DNS change rather than a rewrite.
   */
  get mediaBaseUrl() {
    return opt("NEXT_PUBLIC_MEDIA_BASE_URL");
  },

  lemonSqueezy: {
    get apiKey() {
      return opt("LEMONSQUEEZY_API_KEY");
    },
    get storeId() {
      return opt("LEMONSQUEEZY_STORE_ID");
    },
    get webhookSecret() {
      return opt("LEMONSQUEEZY_WEBHOOK_SECRET");
    },
    variants: {
      get event() {
        return opt("LEMONSQUEEZY_VARIANT_EVENT");
      },
      get wedding() {
        return opt("LEMONSQUEEZY_VARIANT_WEDDING");
      },
      get keep_forever() {
        return opt("LEMONSQUEEZY_VARIANT_KEEP_FOREVER");
      },
    },
  },

  get resendApiKey() {
    return opt("RESEND_API_KEY");
  },
  get emailFrom() {
    return opt("EMAIL_FROM") ?? "Say Cheese <office@reactify-solutions.com>";
  },

  get cronSecret() {
    return opt("CRON_SECRET");
  },

  get mockCheckout() {
    return opt("ENABLE_MOCK_CHECKOUT") === "1";
  },

  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};
    
/**
 * Re-exported rather than recomputed. This used to have its own copy of the
 * key fallback, which is how it could report "configured" for a deployment the
 * Supabase client would then refuse to start against.
 */
export { hasSupabase };

/**
 * Evaluated at import: the storage driver is chosen once per process and
 * swapping it mid-run would leave objects split across two backends.
 */
export const hasS3 = Boolean(
  process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY,
);

export function hasLemonSqueezy(): boolean {
  return Boolean(env.lemonSqueezy.apiKey && env.lemonSqueezy.storeId);
}
