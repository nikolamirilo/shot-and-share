/**
 * The two public Supabase values, read once, the same way everywhere.
 *
 * There were three readers and they disagreed. `env.supabase.publishableKey`
 * and `hasSupabase` both fell back to `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the
 * server client called `required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")` and
 * threw without trying the fallback; the browser client read it with a `!` and
 * got `undefined`. A deployment that set only the anon key therefore reported
 * itself configured, served guest links, and then threw on every request.
 *
 * Deliberately NOT read through the `opt()` helper in @/lib/env. That does
 * `process.env[name]` with a computed name, and Next only substitutes
 * `NEXT_PUBLIC_*` into the browser bundle when it can see the property access
 * written out literally. Spelled out here, both halves survive bundling.
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

/**
 * The pair, or a readable failure. Both callers used to throw their own way -
 * one a "missing variable" error naming only the new name, the other a
 * `undefined is not a valid URL` from deep inside the client library.
 */
export function requireSupabaseConfig(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing required environment variable NEXT_PUBLIC_SUPABASE_URL and/or " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. See .env.example.",
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY };
}
