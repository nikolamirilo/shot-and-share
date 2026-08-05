import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { fail } from "@/lib/api";
import { hasS3 } from "@/lib/env";
import { localPath } from "@/lib/storage/local";

export const runtime = "nodejs";

/**
 * Thumbnails in development, where there is no CDN.
 *
 * In production this route is inert: thumbnails are served from the media
 * hostname straight out of the bucket, with a long cache, and never touch the
 * application. Keeping the media host separate from day one is what makes a
 * later move from Cloudflare to CloudFront a DNS change rather than a rewrite.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (hasS3) {
    return fail("not_found", "Media is served from the CDN in this environment.");
  }

  const { key: segments } = await params;
  const key = segments.join("/");

  // Only ever the thumbnail prefix, and only inside the owner-scoped layout.
  // Originals stay behind signed URLs.
  if (!/^u\/[^/]+\/[^/]+\/thumbs\/[^/]+$/.test(key)) {
    return fail("forbidden", "Not a public object.");
  }

  let size: number;
  try {
    size = (await stat(localPath(key))).size;
  } catch {
    return fail("not_found", "No such object.");
  }

  const stream = createReadStream(localPath(key));
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
