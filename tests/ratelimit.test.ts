import { beforeEach, describe, expect, it, vi } from "vitest";

import { clientIp, rateLimit, resetRateLimits } from "@/lib/ratelimit";

describe("rate limiting", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useRealTimers();
  });

  it("allows up to the limit and then refuses", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("k", 5, 60).ok).toBe(true);
    }
    const blocked = rateLimit("k", 5, 60);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps buckets separate per key", () => {
    rateLimit("a", 1, 60);
    expect(rateLimit("a", 1, 60).ok).toBe(false);
    expect(rateLimit("b", 1, 60).ok).toBe(true);
  });

  it("lets the window lapse", () => {
    vi.useFakeTimers();
    rateLimit("w", 1, 60);
    expect(rateLimit("w", 1, 60).ok).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(rateLimit("w", 1, 60).ok).toBe(true);
  });

  it("reads the client IP from the CDN header first", () => {
    // Cloudflare sits in front, so its header is the trustworthy one; the
    // others are only a development fallback and can be spoofed.
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.7",
      "x-forwarded-for": "10.0.0.1, 10.0.0.2",
    });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("takes the first hop from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.2" });
    expect(clientIp(headers)).toBe("203.0.113.9");
  });
});
