import { createClient } from "@supabase/supabase-js";

import { type Database } from "@/types/db";
import { env, required } from "@/lib/env";

/**
 * Service-role client: bypasses RLS, so it is only for guest traffic and background
 * jobs.
 */
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  if (!cached) {
    /**
     * Accepts `SUPABASE_SERVICE_ROLE_KEY` as well as the current `SUPABASE_SECRET_KEY`.
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
