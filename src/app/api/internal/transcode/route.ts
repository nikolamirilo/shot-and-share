import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { fail, handle, ok, parseBody } from "@/lib/api";
import type { MediaRow } from "@/lib/db/types";
import {
  IMAGE_EXT,
  IMAGE_MIME,
  UNIVERSAL_VIDEO_FORMAT,
  VIDEO_MIME,
} from "@/lib/media-formats";
import { mediaKey, posterKey, scopeOfMedia } from "@/lib/media";
import { storage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The transcode worker's API.
 *
 * The worker handles exactly the two things a browser cannot:
 *
 *   1. Images the browser could not decode - chiefly HEIC anywhere that is not
 *      Safari. Without this, an iPhone photo uploaded from a desktop Chrome is
 *      a file most of the guests and half the hosts cannot open.
 *   2. Video. Compressing a clip client-side means MediaRecorder, which
 *      re-encodes in real time - a two-minute video takes two minutes with a
 *      guest watching a spinner at a party. It has to happen off the phone.
 *
 * The worker never gets AWS credentials. It asks for jobs, receives presigned
 * URLs to read the input and write the outputs, and reports back. That means
 * the thing running ffmpeg on untrusted user input holds nothing worth stealing
 * - which matters, because ffmpeg parsing a hostile file is a real attack
 * surface and this is the process most likely to be compromised.
 */

function authorised(request: Request): boolean {
  const secret = process.env.WORKER_SECRET;
  if (!secret) return false;
  const provided = (request.headers.get("authorization") ?? "").replace(
    /^Bearer /,
    "",
  );
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** How long a job may sit claimed before another worker may take it. */
const CLAIM_MINUTES = 20;

/* -------------------------------------------------------------------------- */

/** Claim a batch of work. */
export async function GET(request: Request) {
  return handle(async () => {
    if (!authorised(request)) return fail("unauthorized", "Bad worker secret.");

    const limit = Math.min(
      10,
      Number(new URL(request.url).searchParams.get("limit") ?? 5),
    );
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("media")
      .select("*")
      .eq("processing", "pending")
      .eq("status", "ready")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);
    const rows = (data ?? []) as MediaRow[];

    const jobs = await Promise.all(
      rows.map(async (row) => {
        const isVideo = row.kind === "video";

        // Output keys are decided here, not by the worker: the worker should
        // not be able to choose where in the bucket it writes. The scope comes
        // off the row itself, so a worker output can only ever land inside the
        // folder of the host who owns the photo.
        const scope = scopeOfMedia(row);
        const outKey = mediaKey(
          scope,
          row.id,
          isVideo ? UNIVERSAL_VIDEO_FORMAT : IMAGE_EXT.jpeg,
        );
        const outMime = isVideo
          ? VIDEO_MIME[UNIVERSAL_VIDEO_FORMAT]
          : IMAGE_MIME.jpeg;

        return {
          mediaId: row.id,
          kind: row.kind,
          mimeType: row.mime_type,
          sizeBytes: Number(row.size_bytes),
          hasPoster: Boolean(row.poster_key),
          input: await storage.presignDownload({
            key: row.media_key,
            expiresInSeconds: CLAIM_MINUTES * 60,
          }),
          outputs: {
            // Not a second rendition: this replaces the object in the bucket,
            // so the event folder is left holding one compressed file.
            media: {
              contentType: outMime,
              upload: await storage.presignUpload({
                key: outKey,
                contentType: outMime,
                // Generous: the worker's output size is not known in advance,
                // and the quota is reconciled when it reports back.
                maxBytes: Math.max(Number(row.size_bytes) * 2, 32 * 1024 * 1024),
                expiresInSeconds: CLAIM_MINUTES * 60,
              }),
            },
            poster:
              isVideo && !row.poster_key
                ? {
                    contentType: IMAGE_MIME.jpeg,
                    upload: await storage.presignUpload({
                      key: posterKey(scope, row.id, IMAGE_EXT.jpeg),
                      contentType: IMAGE_MIME.jpeg,
                      maxBytes: 4 * 1024 * 1024,
                      expiresInSeconds: CLAIM_MINUTES * 60,
                    }),
                  }
                : null,
          },
        };
      }),
    );

    return ok({ jobs, claimMinutes: CLAIM_MINUTES });
  });
}

/* -------------------------------------------------------------------------- */

const completeSchema = z.object({
  mediaId: z.string().uuid(),
  ok: z.boolean(),
  /** Bytes actually written, so the quota reflects reality. */
  mediaBytes: z.number().int().nonnegative().optional(),
  posterBytes: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().max(60_000).nullable().optional(),
  height: z.number().int().positive().max(60_000).nullable().optional(),
  durationSeconds: z.number().nonnegative().max(86_400).nullable().optional(),
  error: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  return handle(async () => {
    if (!authorised(request)) return fail("unauthorized", "Bad worker secret.");

    const body = await parseBody(request, completeSchema);
    const admin = createAdminClient();

    const { data: row } = await admin
      .from("media")
      .select("*")
      .eq("id", body.mediaId)
      .maybeSingle();
    if (!row) return fail("not_found", "No such media row.");
    const media = row as MediaRow;

    if (!body.ok) {
      /*
       * A failed conversion is not a lost file. What the guest uploaded is
       * untouched and still downloadable; the row is marked so it stops being
       * retried forever and so an operator can see it.
       */
      console.error("[transcode] failed", body.mediaId, body.error);
      await admin
        .from("media")
        .update({ processing: "failed" })
        .eq("id", media.id);
      return ok({ recorded: true });
    }

    const isVideo = media.kind === "video";
    // Recomputed from the row rather than taken from the worker's report, for
    // the same reason it was computed here when the job was handed out.
    const scope = scopeOfMedia(media);
    const newKey = mediaKey(
      scope,
      media.id,
      isVideo ? UNIVERSAL_VIDEO_FORMAT : IMAGE_EXT.jpeg,
    );

    const mediaBytes = body.mediaBytes ?? 0;
    const posterBytes = body.posterBytes ?? 0;
    const replaced = mediaBytes > 0;
    const wrotePoster = isVideo && !media.poster_key && posterBytes > 0;

    /*
     * The converted file replaces what the guest uploaded, so the event folder
     * never holds both. The delta can be negative - which is the usual case,
     * since converting is what makes the file smaller - and the quota moves
     * either way. Reserving cannot happen before the size is known.
     */
    const added =
      (replaced ? mediaBytes - Number(media.size_bytes) : 0) +
      (wrotePoster ? posterBytes : 0);

    if (added > 0) {
      const { data: reserved } = await admin.rpc("reserve_storage", {
        p_event: media.event_id,
        p_bytes: added,
      });
      if (!reserved) {
        /*
         * The event filled up between upload and conversion. Keep what the
         * guest uploaded, drop what the worker wrote, and leave the row usable
         * rather than silently pushing the host over their quota.
         */
        if (newKey !== media.media_key) await storage.remove([newKey]);
        await admin
          .from("media")
          .update({ processing: "failed" })
          .eq("id", media.id);
        return ok({ recorded: true, skipped: "quota" });
      }
    } else if (added < 0) {
      await admin.rpc("release_storage", {
        p_event: media.event_id,
        p_bytes: -added,
      });
    }

    await admin
      .from("media")
      .update({
        media_key: replaced ? newKey : media.media_key,
        size_bytes: replaced ? mediaBytes : media.size_bytes,
        media_format: replaced
          ? isVideo
            ? UNIVERSAL_VIDEO_FORMAT
            : "jpeg"
          : media.media_format,
        mime_type: replaced
          ? isVideo
            ? VIDEO_MIME[UNIVERSAL_VIDEO_FORMAT]
            : IMAGE_MIME.jpeg
          : media.mime_type,
        poster_key: wrotePoster
          ? posterKey(scope, media.id, IMAGE_EXT.jpeg)
          : media.poster_key,
        poster_size_bytes: wrotePoster ? posterBytes : media.poster_size_bytes,
        width: body.width ?? media.width,
        height: body.height ?? media.height,
        duration_seconds: body.durationSeconds ?? media.duration_seconds,
        processing: "done",
      })
      .eq("id", media.id);

    /*
     * Last, and only once the row points at the new object: the file the guest
     * uploaded. A HEIC becomes a JPEG and a MOV becomes an MP4, so the key
     * changes and the old object would otherwise sit in the bucket for the life
     * of the event, being paid for and never read. Dropped after the update so
     * a failure here leaves a stray object rather than a broken photo.
     */
    if (replaced && newKey !== media.media_key) {
      await storage.remove([media.media_key]);
    }

    return ok({ recorded: true });
  });
}
