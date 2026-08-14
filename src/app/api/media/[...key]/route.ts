import { Readable } from "node:stream";

import { fail } from "@/lib/api";
import { publicImageType } from "@/lib/media";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * The stable address of a gallery image.
 *
 * One stored object per photo, at full size, so the small version is derived:
 * `next/image` points here, resizes to the tile, and caches at the edge.
 *
 * Why the app serves the bytes at all, when the architecture is otherwise
 * strict that it must not: an optimiser caches by URL, and a private bucket's
 * only other address is a signed URL that changes every hour. Caching on a URL
 * that keeps changing is re-transcoding on every page load.
 *
 * The cost is one invocation per photo per size, on cache miss only. Set
 * NEXT_PUBLIC_MEDIA_BASE_URL to a CDN and this route stops being used.
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
