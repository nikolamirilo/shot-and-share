import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import { env, required } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS, so it exists for exactly two jobs:
 *
 *  1. Guest traffic, which is unauthenticated by design. The route validates
 *     the link token itself and only then queries.
 *  2. Machine work - payment webhooks and the retention job.
 *
 * It must never be imported into a client component or a page that renders
 * host-owned data without an ownership check of its own.
 */
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  if (!cached) {
    /*
     * Read through `env`, which accepts `SUPABASE_SERVICE_ROLE_KEY` as well as
     * the current `SUPABASE_SECRET_KEY`. This used to demand the new name and
     * nothing else, while the token encryption and the local storage driver
     * both took either - so a deployment carrying only the older name passed
     * every "is Supabase configured?" check, served the guest page, and then
     * threw on presign and confirm. The same value under two names must not
     * mean the upload works and the photo never arrives.
     */
    const secretKey = env.supabase.secretKey;
    if (!secretKey) {
      throw new Error(
        "Missing required environment variable SUPABASE_SECRET_KEY " +
          "(or SUPABASE_SERVICE_ROLE_KEY). See .env.example.",
      );
    }

    cached = createClient<Database>(
      required("NEXT_PUBLIC_SUPABASE_URL"),
      secretKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return cached;
}
