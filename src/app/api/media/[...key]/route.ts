import { Readable } from "node:stream";

import { fail } from "@/lib/api";
import { publicImageType } from "@/lib/media";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * The stable address of a gallery image.
 *
 * There is one stored object per photo now and it is full size, so a grid of
 * forty-eight of them is thirty megabytes on venue wifi. The small version is
 * derived rather than stored: `next/image` points at this route, resizes to the
 * tile, and caches the result at the edge. That keeps the bucket holding one
 * file per upload while the phone downloads a fraction of it.
 *
 * Why the app serves the bytes at all, when the architecture is otherwise
 * strict that it must not: an image optimiser caches by URL, and the bucket is
 * private, so the only other address a photo has is a signed URL that changes
 * every hour. Caching on a URL that keeps changing is not caching - it is
 * re-transcoding the same photo on every page load. This route is the stable
 * name the optimiser needs.
 *
 * The cost is bounded and worth stating: one function invocation per photo per
 * size, on cache miss only, after which the edge serves it. Set
 * NEXT_PUBLIC_MEDIA_BASE_URL to a CDN in front of the bucket and this route
 * stops being used - publicUrl() prefers the CDN, and the optimiser fetches
 * from there instead.
 *
 * No token is required, deliberately. The key is three uuids and the event link
 * is already the access control - the same posture a CDN in front of the bucket
 * would have, and the same one thumbnails had before.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  const key = segments.join("/");

  // Gallery images only, and only inside the owner-scoped layout. See
  // publicImageType for what this refuses and why.
  const type = publicImageType(key);
  if (!type) return fail("forbidden", "Not a public object.");

  const head = await storage.head(key);
  if (!head) return fail("not_found", "No such object.");

  const body = await storage.getStream(key);
  return new Response(Readable.toWeb(body) as ReadableStream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(head.size),
      // The key contains the media id and an object is never rewritten under
      // the same key, so this is safe to cache forever.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
