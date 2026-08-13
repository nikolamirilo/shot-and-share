/**
 * The two public Supabase values, read once, the same way everywhere - so a
 * deployment cannot report itself configured and then throw on every request.
 *
 * Deliberately NOT read through `opt()` in @/lib/env: that does
 * `process.env[name]` with a computed name, and Next only substitutes
 * `NEXT_PUBLIC_*` into the browser bundle where it can see the property access
 * written out literally.
 *
 * No `server-only`: the browser client needs this too.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * `PUBLISHABLE_KEY` is the current name; `ANON_KEY` is what Supabase called the
 * same value before, and older deployments still set it.
 */
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Whether there is enough here to build a client at all. */
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

/** The pair, or a readable failure rather than one from inside the client. */
export function requireSupabaseConfig(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing required environment variable NEXT_PUBLIC_SUPABASE_URL and/or " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. See .env.example.",
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY };
}
