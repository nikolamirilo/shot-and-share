import archiver from "archiver";
import { PassThrough } from "node:stream";

import { ApiError, fail, handle, ok } from "@/lib/api";
import { listGuestMediaOldestFirst } from "@/lib/db/media-repo";
import { enforceRateLimit } from "@/lib/guards";
import { requireOwnedEvent } from "@/lib/host";
import { archiveKey, scopeOfEvent } from "@/lib/media";
import { LIMITS } from "@/lib/ratelimit";
import { storage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_ARCHIVE_BUILDS } from "@/lib/tiers";
import type { EventRow, MediaRow } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * Vercel Pro ceiling. A 30 GB wedding archive will outrun this, and the
 * architecture note stands: at that size the job belongs in a Lambda with a
 * streaming writer, or a small Fargate task. Everything below is written to
 * stream rather than buffer, so moving it is a change of host, not of logic.
 */
export const maxDuration = 300;

/** Is the stored ZIP still an accurate picture of the event? */
function archiveIsFresh(event: EventRow, newestMediaAt: string | null): boolean {
  if (!event.archive_key || !event.archive_built_at) return false;
  if (!newestMediaAt) return true;
  return new Date(event.archive_built_at) >= new Date(newestMediaAt);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const event = await requireOwnedEvent(id);

    if (!event.archive_key) {
      return ok({ ready: false, builds: event.archive_builds });
    }
    return ok({
      ready: true,
      builds: event.archive_builds,
      builtAt: event.archive_built_at,
      sizeBytes: event.archive_size_bytes,
      url: await storage.presignDownload({
        key: event.archive_key,
        expiresInSeconds: 900,
        downloadName: `${slug(event.name)}.zip`,
      }),
    });
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const event = await requireOwnedEvent(id);
    const admin = createAdminClient();

    // What the host downloads is what their guests sent. A cover image they
    // uploaded themselves is already on their own disk - see migration 0013.
    const media = await listGuestMediaOldestFirst(admin, event.id);
    if (media.length === 0) {
      throw new ApiError("bad_request", "There is nothing to download yet.");
    }

    const newest = media[media.length - 1].created_at;

    // Build once, store it, serve the same object. A second request inside the
    // retention window must not pay for a second pass over 30 GB.
    if (archiveIsFresh(event, newest) && event.archive_key) {
      return ok({
        rebuilt: false,
        builds: event.archive_builds,
        sizeBytes: event.archive_size_bytes,
        url: await storage.presignDownload({
          key: event.archive_key,
          expiresInSeconds: 900,
          downloadName: `${slug(event.name)}.zip`,
        }),
      });
    }

    if (event.archive_builds >= MAX_ARCHIVE_BUILDS) {
      return fail(
        "rate_limited",
        `This event has been packaged ${MAX_ARCHIVE_BUILDS} times, which is the limit. The last ZIP is still available to download.`,
        { builds: event.archive_builds },
      );
    }

    enforceRateLimit(
      LIMITS.archive,
      `archive:${event.id}`,
      "A ZIP is already being built for this event.",
    );

    const key = archiveKey(scopeOfEvent(event));
    await buildArchive(key, event, media);

    const head = await storage.head(key);
    await admin
      .from("events")
      .update({
        archive_key: key,
        archive_built_at: new Date().toISOString(),
        archive_size_bytes: head?.size ?? null,
        archive_builds: event.archive_builds + 1,
      })
      .eq("id", event.id);

    return ok({
      rebuilt: true,
      builds: event.archive_builds + 1,
      sizeBytes: head?.size ?? null,
      url: await storage.presignDownload({
        key,
        expiresInSeconds: 900,
        downloadName: `${slug(event.name)}.zip`,
      }),
    });
  });
}

/**
 * Streamed end to end: objects come out of storage as streams, go through the
 * zip encoder, and go back up as a multipart upload. Nothing is ever held in
 * memory, which is the only way this works for an event measured in gigabytes.
 */
async function buildArchive(key: string, event: EventRow, media: MediaRow[]) {
  const zip = archiver("zip", {
    // Photos and videos are already compressed. Deflating them again buys
    // almost nothing and costs a lot of CPU time on a metered function.
    zlib: { level: 0 },
    store: true,
  });
  const pass = new PassThrough();
  zip.pipe(pass);

  const uploading = storage.put({
    key,
    body: pass,
    contentType: "application/zip",
    // The lifecycle rule expires archives on this tag. It cannot use a prefix,
    // because S3 prefix filters are literal and events/*/archive/ is not a
    // thing you can express. The ZIP is derived data - losing it costs a
    // rebuild, not a photo.
    tags: { kind: "archive" },
  });

  const failures: string[] = [];
  zip.on("warning", (err) => console.warn("[archive]", err));

  for (const [index, row] of media.entries()) {
    try {
      const stream = await storage.getStream(row.media_key);
      zip.append(stream, { name: entryName(event, row, index) });
    } catch (err) {
      // One unreadable object must not cost the host the other 2,499 photos.
      failures.push(row.id);
      console.error("[archive] skipped", row.id, err);
    }
  }

  zip.append(README_TEXT, { name: `${slug(event.name)}/README.txt` });

  if (failures.length > 0) {
    zip.append(
      `These ${failures.length} files could not be read and were left out:\n${failures.join("\n")}\n`,
      { name: "MISSING.txt" },
    );
  }

  await zip.finalize();
  await uploading;
}

const README_TEXT = `Your photos from Shot & Share
============================

Everything guests uploaded is in this folder, named by the time it was taken.

Photos are stored compressed: full resolution for any screen and for printing
up to A4, at about a quarter of the size a phone would have produced. Anything
that arrived in Apple's HEIC format has been converted to JPEG, so every file
here opens on Windows, Chrome and Firefox as well as on an iPhone.

Videos have been converted to MP4 so they play on anything.
`;

function entryName(event: EventRow, row: MediaRow, index: number): string {
  const ext = row.media_key.split(".").pop() ?? "jpg";
  const stamp = row.created_at.slice(0, 19).replace(/[:T]/g, "-");
  const who = row.uploader_name ? `-${slug(row.uploader_name)}` : "";
  return `${slug(event.name)}/${String(index + 1).padStart(4, "0")}-${stamp}${who}.${ext}`;
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "event"
  );
}
