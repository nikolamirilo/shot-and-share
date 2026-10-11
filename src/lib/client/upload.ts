"use client";

import {
  FINGERPRINT_KEY,
  OPENED_PREFIX,
} from "@/constants/storage-keys";
import type { PresignedUpload } from "@/lib/storage/types";

/**
 * `crypto.randomUUID` exists only on HTTPS and localhost, and a phone opening the share
 * link by IP on venue wifi has neither.
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

export function getFingerprint(): string {
  try {
    const existing = localStorage.getItem(FINGERPRINT_KEY);
    if (existing) return existing;
    const fresh = randomId();
    localStorage.setItem(FINGERPRINT_KEY, fresh);
    return fresh;
  } catch {
    return randomId();
  }
}

export function markOpened(eventId: string): boolean {
  try {
    const key = `${OPENED_PREFIX}${eventId}`;
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}

export class UploadError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
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

  let payload: { error?: { message?: string; upgrade?: boolean } } | null = null;
  try {
    payload = await response.json();
  } catch {
  }

  if (!response.ok) {
    throw new UploadError(
      payload?.error?.message ?? `Request failed (HTTP ${response.status}).`,
      response.status >= 500 || response.status === 429,
      Boolean(payload?.error?.upgrade),
    );
  }

  return payload as T;
}

/**
 * Three different misconfigurations all surface as 403, so the reason comes from the
 * XML body. Regex rather than DOMParser: the body may be truncated or empty.
 */
function s3Reason(responseText: string): string | null {
  const code = /<Code>([^<]+)<\/Code>/.exec(responseText)?.[1];
  const message = /<Message>([^<]+)<\/Message>/.exec(responseText)?.[1];
  if (!code) return null;
  return message ? `${code}: ${message}` : code;
}

/**
 * Progress, not elapsed time: a 200 MB clip on hotel wifi legitimately takes twenty
 * minutes.
 */
const STALL_MS = 60_000;
const STALL_CHECK_MS = 5_000;

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
      fail("The connection stopped responding.", true);
      try {
        xhr.abort();
      } catch {
      }
    }, STALL_CHECK_MS);

    xhr.open("POST", presigned.url, true);

    xhr.upload.onprogress = (event) => {
      lastTick = Date.now();
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };
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
        xhr.status >= 500,
        xhr.responseText?.slice(0, 500),
      );
    };
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
