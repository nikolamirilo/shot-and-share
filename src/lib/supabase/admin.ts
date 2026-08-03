import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import { required } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS, so it exists for exactly two jobs:
 *
 *  1. Guest traffic, which is unauthenticated by design. The route validates
 *     the link token itself and only then queries.
 *  2. Machine work — payment webhooks and the retention job.
 *
 * It must never be imported into a client component or a page that renders
 * host-owned data without an ownership check of its own.
 */
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  if (!cached) {
    cached = createClient<Database>(
      required("NEXT_PUBLIC_SUPABASE_URL"),
      required("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return cached;
}
