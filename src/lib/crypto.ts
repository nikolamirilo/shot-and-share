import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Share tokens are stored twice: hashed for lookup, and encrypted so the host
 * can see their own QR code again tomorrow.
 *
 * Hash-only storage is the stricter design, and it is the wrong one here: a
 * host who loses the tab would have to reissue the link, which invalidates
 * every printed card on every table. Encrypting instead keeps the useful
 * property — a stolen database dump alone yields no working links — while
 * letting the dashboard render the code on demand.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

let keyCache: Buffer | null = null;

function key(): Buffer {
  if (keyCache) return keyCache;

  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) {
      throw new Error(
        "TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded. Generate one with: openssl rand -base64 32",
      );
    }
    keyCache = buf;
    return buf;
  }

  // Development fallback. Set TOKEN_ENCRYPTION_KEY in production: without it a
  // leaked Supabase secret key is enough to decrypt tokens as well as read rows.
  const fallback =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "say-cheese-development-secret";
  keyCache = scryptSync(fallback, "say-cheese-token-v1", 32);
  return keyCache;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function decryptToken(payload: string): string | null {
  try {
    const [ivPart, dataPart, tagPart] = payload.split(".");
    if (!ivPart || !dataPart || !tagPart) return null;

    const decipher = createDecipheriv(
      ALGORITHM,
      key(),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Test hook: the key is cached per process. */
export function resetKeyCache() {
  keyCache = null;
}
