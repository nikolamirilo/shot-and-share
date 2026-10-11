/**
 * Read as static `process.env.NEXT_PUBLIC_*` member accesses: Next only
 * substitutes that exact expression, and a computed lookup compiles to
 * `undefined` in the browser.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * `PUBLISHABLE_KEY` is the current name; `ANON_KEY` is what Supabase called the same
 * value before.
 */
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export function requireSupabaseConfig(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing required environment variable NEXT_PUBLIC_SUPABASE_URL and/or " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. See .env.example.",
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY };
}
