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
 * property - a stolen database dump alone yields no working links - while
 * letting the dashboard render the code on demand.
 *
 * Which means the key outlives the deployment that set it. Change it and every
 * token written under the old one becomes unreadable, and the dashboard - which
 * has no way to tell "unreadable" from "revoked" unless it is told - offers to
 * reissue a link that is still live on every printed card. So decryption tries
 * the keys we used to use as well as the one we use now, and a caller that can
 * write re-encrypts what it read.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const SALT = "say-cheese-token-v1";

/**
 * The last resort in development. Named here rather than inline because the
 * legacy list has to be able to derive the same key again.
 */
const DEV_SECRET = "say-cheese-development-secret";

let currentCache: Buffer | null = null;
let legacyCache: Buffer[] | null = null;

function fromBase64(raw: string, name: string): Buffer {
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `${name} must be 32 bytes, base64 encoded. Generate one with: openssl rand -base64 32`,
    );
  }
  return buf;
}

/** Anything that is not a 32-byte key of its own becomes one this way. */
function derive(secret: string): Buffer {
  return scryptSync(secret, SALT, 32);
}

/** The key everything is written under. */
function key(): Buffer {
  if (currentCache) return currentCache;

  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (raw) {
    currentCache = fromBase64(raw, "TOKEN_ENCRYPTION_KEY");
    return currentCache;
  }

  // Development fallback. Set TOKEN_ENCRYPTION_KEY in production: without it a
  // leaked Supabase secret key is enough to decrypt tokens as well as read rows,
  // and rotating that key takes every existing share link's QR code with it.
  currentCache = derive(
    process.env.SUPABASE_SECRET_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      DEV_SECRET,
  );
  return currentCache;
}

/**
 * Keys a token might have been written under before the current one, newest
 * first. Two ways a deployment gets here: TOKEN_ENCRYPTION_KEY_PREVIOUS, set by
 * hand when the key is rotated deliberately, and the derivations above, which
 * cover the accidental rotation - a deployment that had no TOKEN_ENCRYPTION_KEY
 * and then set one, or that changed the Supabase secret key it was deriving
 * from.
 *
 * Built on the first failed read rather than at startup: each derivation is a
 * scrypt, and a healthy deployment never needs one.
 */
function legacyKeys(): Buffer[] {
  if (legacyCache) return legacyCache;

  const previous = (process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => fromBase64(part, "TOKEN_ENCRYPTION_KEY_PREVIOUS"));

  const secrets = [
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    DEV_SECRET,
  ].filter((secret): secret is string => Boolean(secret));

  const current = key().toString("hex");
  const seen = new Set([current]);
  legacyCache = [...previous, ...secrets.map(derive)].filter((candidate) => {
    const hex = candidate.toString("hex");
    if (seen.has(hex)) return false;
    seen.add(hex);
    return true;
  });
  return legacyCache;
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

function open(payload: string, using: Buffer): string | null {
  try {
    const [ivPart, dataPart, tagPart] = payload.split(".");
    if (!ivPart || !dataPart || !tagPart) return null;

    const decipher = createDecipheriv(
      ALGORITHM,
      using,
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

/**
 * The token, and whether it came back under a key we no longer write with.
 * `stale` is an instruction to whoever can write: store it again, or the next
 * read pays for the same search.
 */
export function readToken(
  payload: string,
): { token: string; stale: boolean } | null {
  const token = open(payload, key());
  if (token !== null) return { token, stale: false };

  for (const candidate of legacyKeys()) {
    const older = open(payload, candidate);
    if (older !== null) return { token: older, stale: true };
  }
  return null;
}

export function decryptToken(payload: string): string | null {
  return readToken(payload)?.token ?? null;
}

/** Test hook: the keys are cached per process. */
export function resetKeyCache() {
  currentCache = null;
  legacyCache = null;
}
