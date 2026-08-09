import "server-only";

import { ApiError } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

/**
 * The rate-limit check every route was writing out by hand.
 *
 * `rateLimit` takes the key, the count and the window as three separate
 * arguments, so five routes each spelled out `LIMITS.x.limit, LIMITS.x.window`
 * and then a four-line `if (!limit.ok) return fail(...)`. Taking the policy as
 * one object means the count and the window cannot be read off different
 * limits, and throwing means the caller is one line.
 *
 * `handle()` in @/lib/api turns the ApiError into the same 429 the routes were
 * building themselves, retry header included.
 */
export function enforceRateLimit(
  policy: { limit: number; window: number },
  key: string,
  message: string,
): void {
  const result = rateLimit(key, policy.limit, policy.window);
  if (!result.ok) {
    throw new ApiError("rate_limited", message, {
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
}
