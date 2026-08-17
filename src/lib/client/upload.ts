"use client";

import type { PresignedUpload } from "@/lib/storage/types";

const FINGERPRINT_KEY = "say-cheese:fingerprint";

/**
 * A random identifier that does not need a secure context.
 *
 * `crypto.randomUUID` exists only on HTTPS and localhost. Over plain HTTP - a
 * phone opening the share link by IP on the venue wifi - it is simply not
 * there, so calling it throws and the whole upload is gone before the first
 * byte. `getRandomValues` is available in those places, and this falls back
 * again where even it is missing.
 *
 * Not a security boundary: the value identifies a browser to itself so it can
 * delete its own photo.
 */
function randomId(): string {
  const c: Crypto | undefined = globalThis.crypto;

  if (typeof c?.randomUUID === "function") {
    return c.randomUUID().replace(/-/g, "");
  }

  if (typeof c?.getRandomValues === "function") {
    const bytes = c.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}

/**
 * Not an account, deliberately. A random id in localStorage is exactly enough
 * to let a guest remove the blurry photo they just uploaded, and nothing more.
 */
export function getFingerprint(): string {
  try {
    const existing = localStorage.getItem(FINGERPRINT_KEY);
    if (existing) return existing;
    const fresh = randomId();
    localStorage.setItem(FINGERPRINT_KEY, fresh);
    return fresh;
  } catch {
    // Private mode, or storage disabled. Uploads still work; only the
    // remove-my-own-photo affordance is lost.
    return randomId();
  }
}

export function markOpened(eventId: string): boolean {
  try {
    const key = `say-cheese:opened:${eventId}`;
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}

/* --- failures ------------------------------------------------------------- */

/**
 * `retryable` is the whole point of the class. A dropped connection and a
 * bucket policy rejection both arrive as "the upload did not work", and the
 * right response is opposite: one deserves another go, the other will say the
 * same thing every time and retrying only makes the guest wait longer for it.
 */
export class UploadError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
    /** The host has run out of room, and only the host can fix it. */
    readonly upgrade = false,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

function retryable(error: unknown): boolean {
  if (error instanceof UploadError) return error.retryable;
  // fetch throws a bare TypeError when the request never reached a server.
  return error instanceof TypeError;
}

const RETRY_DELAYS_MS = [600, 1800];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Three attempts, then give up. Venue wifi drops one request in twenty and
 * recovers by itself; without this a guest loses a photo to a blip that lasted
 * under a second, and the only repair is finding the file again in a camera
 * roll of four thousand pictures.
 */
export async function withRetry<T>(task: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !retryable(error)) throw error;
      await sleep(delay);
    }
  }
}

/** A POST to our own API, with the error body turned into something throwable. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new UploadError("Could not reach the server.", true);
  }

  // A proxy error page is not JSON, and losing the status code to a parse
  // failure would turn a plain 502 into "something went wrong".
  let payload: { error?: { message?: string; upgrade?: boolean } } | null = null;
  try {
    payload = await response.json();
  } catch {
    /* keep whatever the status tells us */
  }

  if (!response.ok) {
    throw new UploadError(
      payload?.error?.message ?? `Request failed (HTTP ${response.status}).`,
      // 5xx and 429 pass; a 400, 403 or 413 is a considered answer that will
      // not change however many times it is asked.
      response.status >= 500 || response.status === 429,
      Boolean(payload?.error?.upgrade),
    );
  }

  return payload as T;
}

/* --- the upload itself ----------------------------------------------------- */

/**
 * S3 answers a rejected POST with an XML body naming the reason. The status
 * code alone does not: three different misconfigurations all surface as 403.
 *
 * Regex rather than DOMParser because the body may be truncated or empty, and a
 * parser that throws on that would lose the one piece of information worth
 * having.
 */
function s3Reason(responseText: string): string | null {
  const code = /<Code>([^<]+)<\/Code>/.exec(responseText)?.[1];
  const message = /<Message>([^<]+)<\/Message>/.exec(responseText)?.[1];
  if (!code) return null;
  return message ? `${code}: ${message}` : code;
}

/**
 * How long an upload may make no progress before it is abandoned.
 *
 * A flat `xhr.timeout` is the obvious thing and it is wrong: a 200 MB clip on
 * hotel wifi legitimately takes twenty minutes, and any ceiling generous enough
 * for that is no protection against a connection that has silently died.
 * Progress is the signal that matters, not elapsed time.
 */
const STALL_MS = 60_000;
const STALL_CHECK_MS = 5_000;

/**
 * Uploads straight to storage. Files never pass through the application server,
 * which is what keeps the app on a free hosting tier however many photos move
 * through it.
 *
 * Every failure here is one the guest cannot act on and the operator can, so
 * the reason goes to the console verbatim while the guest gets a sentence.
 */
export function uploadToPresigned(
  presigned: PresignedUpload,
  body: Blob,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(presigned.fields)) {
      form.append(key, value);
    }
    // S3 requires the file field last; everything before it is policy.
    form.append(presigned.fileField, body);

    let settled = false;
    let lastTick = Date.now();

    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearInterval(watchdog);
      action();
    };

    const fail = (summary: string, canRetry: boolean, detail?: string) => {
      console.error(
        `[upload] ${summary}`,
        { key: presigned.fields.key, bytes: body.size, type: body.type },
        detail ?? "",
      );
      settle(() => reject(new UploadError(summary, canRetry)));
    };

    const xhr = new XMLHttpRequest();

    const watchdog = setInterval(() => {
      if (Date.now() - lastTick < STALL_MS) return;
      // Reject first: abort() fires onabort, and settle() makes sure the
      // clearer message is the one the guest gets.
      fail("The connection stopped responding.", true);
      try {
        xhr.abort();
      } catch {
        /* already finished */
      }
    }, STALL_CHECK_MS);

    xhr.open("POST", presigned.url, true);

    xhr.upload.onprogress = (event) => {
      lastTick = Date.now();
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };
    // The bytes are gone; the reply may still take a moment. Restarting the
    // clock here stops a slow-answering bucket looking like a stall.
    xhr.upload.onload = () => {
      lastTick = Date.now();
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return settle(resolve);
      const reason = s3Reason(xhr.responseText ?? "");
      fail(
        reason
          ? `Storage rejected the upload - ${reason}`
          : `Storage rejected the upload (HTTP ${xhr.status})`,
        // A rejection with a status is the bucket's considered answer - a bad
        // policy, a blob over the signed ceiling - and it will not change.
        // A 5xx is the exception: that is the bucket having a bad minute.
        xhr.status >= 500,
        xhr.responseText?.slice(0, 500),
      );
    };
    /*
     * status 0 on error means the browser never let us see a response. In
     * practice that is CORS - the bytes may well have arrived and been stored,
     * and only the reply was blocked - which is why it is worth saying rather
     * than calling every one of them a dropped connection.
     *
     * Retryable either way: if it was CORS the retry fails identically and
     * costs two seconds, and if it was the network the retry is the fix.
     */
    xhr.onerror = () =>
      fail(
        xhr.status === 0
          ? "Could not reach storage. The bucket's CORS rules may not allow this site."
          : `Network dropped mid-upload (HTTP ${xhr.status}).`,
        true,
      );
    xhr.onabort = () => fail("Upload was interrupted.", true);

    xhr.send(form);
  });
}

/* --- concurrency ----------------------------------------------------------- */

/**
 * A gate that lets `size` tasks through at once.
 *
 * One per stage is what makes the uploader a pipeline: every file runs its own
 * chain start to finish, and the gates cap how many are in each stage. See
 * useUploadQueue for why compressing and uploading get separate ones.
 */
export function gate(size: number) {
  let active = 0;
  const waiting: Array<() => void> = [];

  return async function pass<T>(task: () => Promise<T>): Promise<T> {
    if (active >= size) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}
