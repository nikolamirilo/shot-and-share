import "server-only";

import { ApiError } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

/**
 * The rate-limit check, as one line at the call site.
 *
 * Taking the policy as one object means the count and the window cannot be read
 * off different limits. `handle()` in @/lib/api turns the ApiError into a 429,
 * retry header included.
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
