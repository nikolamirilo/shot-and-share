import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The share link is the access control for the whole guest side, so the token
 * is high entropy and stored hashed. A database leak must not hand anybody a
 * working upload link.
 */

const TOKEN_BYTES = 24; // 192 bits, 32 base64url characters

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Tokens appear in URLs, so reject anything that is not the shape we issue. */
export function looksLikeToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{20,64}$/.test(value);
}

export function shareUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/$/, "")}/e/${token}`;
}
