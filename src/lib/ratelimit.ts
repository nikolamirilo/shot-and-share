/**
 * In-process rate limiting.
 *
 * This is the second line, not the first. The architecture puts per-token and
 * per-IP limits at the CDN edge, where they work across every instance and cost
 * nothing to run. What lives here catches the obvious cases - a script hammering
 * the presign endpoint on one warm instance - and keeps the development server
 * honest. On serverless, counters are per instance and reset on cold start, so
 * do not treat these numbers as a guarantee.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Bounded so a flood of distinct keys cannot grow the map without limit. */
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
    if (buckets.size > MAX_KEYS) buckets.clear();
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const ok = existing.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: ok ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

export const LIMITS = {
  /**
   * Presign requests per device, per minute.
   *
   * One per file, and a guest may now pick as many files as the event has room
   * for - so this is sized at four big picks (`BIG_PICK` in lib/tiers), with a
   * test holding the two together.
   *
   * Keyed per device rather than per link and address. Two hundred guests at a
   * venue share one wifi and therefore one address, and a limit they shared
   * would mean the twentieth guest of the evening being told to wait because
   * the nineteenth was uploading. Still bounded: the cost of a presign is a
   * signature, and the quota check inside it is what actually stops anyone
   * filling the bucket.
   */
  presign: { limit: 4 * 300, window: 60 },
  /** Guest page loads per IP, per minute. */
  guestPage: { limit: 60, window: 60 },
  /**
   * Reports per IP, per hour.
   *
   * A report hides a photograph immediately, which is the point of it and also
   * the obvious way to vandalise somebody's wedding gallery. Low enough that
   * one phone cannot clear a wall, high enough that a guest genuinely upset by
   * three photographs is not cut off after the first.
   */
  report: { limit: 10, window: 3600 },
  /**
   * Cover images a host may upload to one event, per minute.
   *
   * Deliberately much lower than `presign`: a host picks one cover, looks at
   * it, and picks another if they do not like it. Anything past a handful in a
   * minute is a stuck retry loop rather than somebody choosing.
   */
  coverUpload: { limit: 10, window: 60 },
  /** Archive builds are the biggest cost line in the system. */
  archive: { limit: 5, window: 3600 },
  /** Event creation per host, per hour. */
  createEvent: { limit: 20, window: 3600 },
  /** Sign-in attempts per IP. Low enough to blunt credential stuffing. */
  signIn: { limit: 10, window: 300 },
  /** Sign-ups per IP, per hour. */
  signUp: { limit: 5, window: 3600 },
  /**
   * Reset emails per IP, per hour. Supabase throttles per address; this
   * throttles the sender, which is the part an attacker controls.
   */
  passwordReset: { limit: 5, window: 3600 },
} as const;

export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

/** Test hook. */
export function resetRateLimits() {
  buckets.clear();
}
