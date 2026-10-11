import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { HeaderUser } from "@/components/layout/SiteHeader";
import { type Database } from "@/types/db";
import { hasSupabase, requireSupabaseConfig } from "@/lib/supabase/config";

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

/** The only three things the header shows about an account. */
function pickDisplay(
  email: string | null,
  meta: Record<string, unknown>,
): HeaderUser {
  return {
    name: (meta.full_name as string | undefined) ?? null,
    email,
    avatarUrl:
      (meta.avatar_url as string | undefined) ??
      (meta.picture as string | undefined) ??
      null,
  };
}

/** For pages that already hold a user and should not pay for a second lookup. */
export function headerUser(user: User | null): HeaderUser | null {
  if (!user) return null;
  return pickDisplay(user.email ?? null, user.user_metadata ?? {});
}

/**
 * Claims, not getUser: the header renders in front of every page and getUser is
 * a round trip.
 */
export async function getHeaderUser(): Promise<HeaderUser | null> {
  if (!hasSupabase) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  return pickDisplay(
    claims.email ?? null,
    (claims.user_metadata ?? {}) as Record<string, unknown>,
  );
}
