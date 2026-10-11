import "server-only";

import { ApiError } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

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
