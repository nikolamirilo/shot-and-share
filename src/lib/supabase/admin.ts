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
     * the current `SUPABASE_SECRET_KEY` - as the token encryption and the local
     * storage driver both do. Demanding only the new name here would let a
     * deployment carrying the older one pass every "is Supabase configured?"
     * check, serve the guest page, and then throw on presign and confirm.
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
