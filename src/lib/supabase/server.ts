import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/db/types";
import { hasSupabase, requireSupabaseConfig } from "@/lib/supabase/config";

/**
 * The host's client. Every read runs under Row Level Security, so a query that
 * forgets a `.eq("owner_id", ...)` still cannot cross a tenant boundary.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const { url, key } = requireSupabaseConfig();

  return createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // middleware.ts refreshes the session, so this is safe to swallow.
          }
        },
      },
    },
  );
}

export async function getSessionUser() {
  if (!hasSupabase) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
