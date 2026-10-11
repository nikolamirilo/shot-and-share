import "server-only";

import { env } from "@/lib/env";

const TIMEOUT_MS = 4000;

const MAX_BYTES = 8_000_000;

export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  return null;
}

export function absoluteCardUrl(url: string, base = env.siteUrl): string {
  return new URL(url, base).toString();
}

export async function fetchCardPhoto(url: string | null): Promise<string | null> {
  if (!url) return null;

  try {
    const res = await fetch(absoluteCardUrl(url), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BYTES) return null;

    const bytes = new Uint8Array(await res.arrayBuffer());
    // The header is a claim; the body is the thing. A chunked response can be over the
    // limit with no content-length to say so.
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;

    const type = sniffImageType(bytes);
    if (!type) return null;

    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}
