import "server-only";

/**
 * Reading a cover photograph into a social card.
 *
 * Satori draws the card, and it will not go and get a picture on its own
 * terms: a URL it cannot fetch, a format it cannot decode or a file that takes
 * too long all fail inside the render, which means a broken image rather than
 * a card. So the bytes are fetched here first, checked, and handed over as a
 * data URL - and anything that goes wrong returns null, which the card reads
 * as "no photograph" and draws its typographic self instead.
 */

/**
 * Four seconds. A crawler unfurling a link in a chat gives us a few seconds in
 * total, and a card that arrives without the photograph beats no card at all.
 */
const TIMEOUT_MS = 4000;

/**
 * The full-size copy is a JPEG at whatever the camera shot, which on a recent
 * phone is a couple of megabytes. Past this we would be spending a crawler's
 * whole budget on a picture about to be scaled to 1200px wide anyway.
 */
const MAX_BYTES = 8_000_000;

/**
 * JPEG and PNG, by their first bytes rather than by the address or the header
 * the CDN claims.
 *
 * Only these two on purpose. The full copy this reads is always JPEG (see
 * FULL_IMAGE_FORMAT) and the odd older row is a PNG; the thumbnails are WebP,
 * which the renderer's decoder does not reliably take. A format we are unsure
 * of is not worth a card that fails to draw.
 */
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

/** The cover as a data URL the card can draw, or null to draw it without one. */
export async function fetchCardPhoto(url: string | null): Promise<string | null> {
  if (!url) return null;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;

    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BYTES) return null;

    const bytes = new Uint8Array(await res.arrayBuffer());
    // The header is a claim; the body is the thing. A truncated or chunked
    // response can be over the limit with no content-length to say so.
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;

    const type = sniffImageType(bytes);
    if (!type) return null;

    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    // A CDN that is slow, down, or serving a signature that has just expired.
    return null;
  }
}
