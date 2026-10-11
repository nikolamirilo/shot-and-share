import { Readable } from "node:stream";

import { fail } from "@/lib/api";
import { publicImageType } from "@/lib/media";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  const key = segments.join("/");

  // Gallery images only - see publicImageType for what this refuses.
  const type = publicImageType(key);
  if (!type) return fail("forbidden", "Not a public object.");

  const head = await storage.head(key);
  if (!head) return fail("not_found", "No such object.");

  const body = await storage.getStream(key);
  return new Response(Readable.toWeb(body) as ReadableStream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(head.size),
      // The key carries the media id and is never rewritten, so this is safe forever.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
