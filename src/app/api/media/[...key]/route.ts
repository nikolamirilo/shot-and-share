import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { fail } from "@/lib/api";
import { hasS3 } from "@/lib/env";
import { localPath } from "@/lib/storage/local";

export const runtime = "nodejs";

/**
 * Gallery images in development, where there is no CDN.
 *
 * In production this route is inert: images are served from the media hostname
 * straight out of the bucket, with a long cache, and never touch the
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

  /*
   * Images only, and only inside the owner-scoped layout: `{owner}/{event}/…`.
   * Videos and the ZIP stay behind signed URLs, which is also what stops this
   * route being a way to pull a 30 GB archive out of the app process.
   */
  const match = /^[^/]+\/[^/]+\/[^/]+\.(webp|jpe?g|png|gif|avif|heic|heif)$/i.exec(
    key,
  );
  if (!match) return fail("forbidden", "Not a public object.");

  let size: number;
  try {
    size = (await stat(localPath(key))).size;
  } catch {
    return fail("not_found", "No such object.");
  }

  const ext = match[1].toLowerCase();
  const type =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "heif"
        ? "image/heic"
        : `image/${ext}`;

  const stream = createReadStream(localPath(key));
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
