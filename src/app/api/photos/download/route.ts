import archiver from "archiver";
import { Readable, PassThrough } from "node:stream";

import { ApiError, handle } from "@/lib/api";
import { requireVisibleGallery } from "@/lib/guards/guest";
import { storage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MediaRow } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    let body: { token?: string; ids?: string[] };
    try {
      body = await request.json();
    } catch {
      throw new ApiError("bad_request", "Expected a JSON body.");
    }

    const { token, ids } = body;

    if (!token || typeof token !== "string") {
      throw new ApiError("bad_request", "Missing share token.");
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError("bad_request", "No photos selected.");
    }
    if (ids.length > 100) {
      throw new ApiError("bad_request", "Select at most 100 photos at once.");
    }

    const ctx = await requireVisibleGallery(token);
    const admin = createAdminClient();

    const { data } = await admin
      .from("media")
      .select("id, media_key, created_at")
      .in("id", ids)
      .eq("event_id", ctx.event.id)
      .eq("status", "ready");

    const rows = (data as Pick<MediaRow, "id" | "media_key" | "created_at">[]) ?? [];

    if (rows.length === 0) {
      throw new ApiError("not_found", "No photos found.");
    }

    const zip = archiver("zip", {
      zlib: { level: 0 },
      store: true,
    });
    const pass = new PassThrough();
    zip.pipe(pass);

    zip.on("warning", (err) => console.warn("[photos/download]", err));
    zip.on("error", (err) => console.error("[photos/download]", err));

    const failures: string[] = [];
    for (const [index, row] of rows.entries()) {
      try {
        const stream = await storage.getStream(row.media_key);
        const ext = row.media_key.split(".").pop() ?? "jpg";
        const stamp = row.created_at.slice(0, 19).replace(/[:T]/g, "-");
        const name = `${String(index + 1).padStart(3, "0")}-${stamp}.${ext}`;
        zip.append(stream, { name });
      } catch (err) {
        failures.push(row.id);
        console.error("[photos/download] skipped", row.id, err);
      }
    }

    if (failures.length > 0) {
      zip.append(
        `These ${failures.length} files could not be read and were left out:\n${failures.join("\n")}\n`,
        { name: "MISSING.txt" },
      );
    }

    void zip.finalize().catch((err) => {
      console.error("[photos/download] finalize", err);
      pass.destroy(err);
    });

    const webStream = Readable.toWeb(pass) as unknown as ReadableStream<Uint8Array>;

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="photos-${Date.now()}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
