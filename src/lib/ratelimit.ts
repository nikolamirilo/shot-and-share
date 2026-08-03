/**
 * In-process rate limiting.
 *
 * This is the second line, not the first. The architecture puts per-token and
 * per-IP limits at the CDN edge, where they work across every instance and cost
 * nothing to run. What lives here catches the obvious cases — a script hammering
 * the presign endpoint on one warm instance — and keeps the development server
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
  /** Presign requests per link, per minute. A guest batch is one request. */
  presign: { limit: 20, window: 60 },
  /** Guest page loads per IP, per minute. */
  guestPage: { limit: 60, window: 60 },
  /** Archive builds are the biggest cost line in the system. */
  archive: { limit: 5, window: 3600 },
  /** Event creation per host, per hour. */
  createEvent: { limit: 20, window: 3600 },
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
