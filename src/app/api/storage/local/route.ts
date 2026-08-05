import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { fail } from "@/lib/api";
import { hasS3 } from "@/lib/env";
import { localPath, safeKey, verifyLocal } from "@/lib/storage/local";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stands in for S3 in development. It enforces the same three things a
 * presigned POST does - expiry, key, and a maximum body size - so code that
 * works against this driver works against the real bucket.
 */

function disabled() {
  return fail(
    "not_found",
    "The local storage driver is off because S3 is configured.",
  );
}

export async function POST(request: Request) {
  if (hasS3) return disabled();

  const form = await request.formData();
  const key = String(form.get("key") ?? "");
  const exp = String(form.get("exp") ?? "");
  const max = String(form.get("max") ?? "");
  const contentType = String(form.get("Content-Type") ?? "");
  const sig = String(form.get("sig") ?? "");
  const file = form.get("file");

  if (!key || !exp || !max || !sig || !(file instanceof Blob)) {
    return fail("bad_request", "Malformed upload.");
  }
  if (!verifyLocal(["put", key, exp, max, contentType], sig)) {
    return fail("forbidden", "Signature does not match.");
  }
  if (Number(exp) * 1000 < Date.now()) {
    return fail("forbidden", "This upload URL has expired.");
  }
  if (file.size > Number(max)) {
    // The same rejection S3 gives on a content-length-range violation.
    return fail("bad_request", "File is larger than the signed limit.");
  }
  if (contentType && file.type && file.type !== contentType) {
    return fail("bad_request", "Content type does not match the signature.");
  }

  await storage.put({
    key: safeKey(key),
    body: Buffer.from(await file.arrayBuffer()),
    contentType: contentType || "application/octet-stream",
  });

  return new Response(null, { status: 204 });
}

export async function GET(request: Request) {
  if (hasS3) return disabled();

  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const exp = url.searchParams.get("exp") ?? "";
  const name = url.searchParams.get("name") ?? "";
  const sig = url.searchParams.get("sig") ?? "";

  if (!verifyLocal(["get", key, exp, name], sig)) {
    return fail("forbidden", "Signature does not match.");
  }
  if (Number(exp) * 1000 < Date.now()) {
    return fail("forbidden", "This link has expired.");
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
      "Content-Length": String(size),
      "Cache-Control": "private, max-age=60",
      ...(name
        ? { "Content-Disposition": `attachment; filename="${name.replace(/"/g, "")}"` }
        : {}),
    },
  });
}
