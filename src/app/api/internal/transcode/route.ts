import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { fail, handle, ok, parseBody } from "@/lib/api";
import type { MediaRow } from "@/lib/db/types";
import {
  IMAGE_EXT,
  IMAGE_MIME,
  UNIVERSAL_VIDEO_FORMAT,
  VIDEO_MIME,
} from "@/lib/formats";
import { displayKey, posterKey, thumbKey } from "@/lib/media";
import { storage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The transcode worker's API.
 *
 * The worker handles exactly the two things a browser cannot:
 *
 *   1. Images the browser could not decode — chiefly HEIC anywhere that is not
 *      Safari. Without this, an iPhone photo uploaded from a desktop Chrome is
 *      a file most of the guests and half the hosts cannot open.
 *   2. Video. Compressing a clip client-side means MediaRecorder, which
 *      re-encodes in real time — a two-minute video takes two minutes with a
 *      guest watching a spinner at a party. It has to happen off the phone.
 *
 * The worker never gets AWS credentials. It asks for jobs, receives presigned
 * URLs to read the input and write the outputs, and reports back. That means
 * the thing running ffmpeg on untrusted user input holds nothing worth stealing
 * — which matters, because ffmpeg parsing a hostile file is a real attack
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
        // not be able to choose where in the bucket it writes.
        const outDisplayKey = isVideo
          ? displayKey(row.event_id, row.id, UNIVERSAL_VIDEO_FORMAT)
          : displayKey(row.event_id, row.id, IMAGE_EXT.jpeg);
        const outDisplayMime = isVideo
          ? VIDEO_MIME[UNIVERSAL_VIDEO_FORMAT]
          : IMAGE_MIME.jpeg;

        return {
          mediaId: row.id,
          kind: row.kind,
          mimeType: row.mime_type,
          sizeBytes: Number(row.size_bytes),
          hasThumb: Boolean(row.thumb_key),
          hasPoster: Boolean(row.poster_key),
          input: await storage.presignDownload({
            key: row.original_key,
            expiresInSeconds: CLAIM_MINUTES * 60,
          }),
          outputs: {
            display: {
              contentType: outDisplayMime,
              upload: await storage.presignUpload({
                key: outDisplayKey,
                contentType: outDisplayMime,
                // Generous: the worker's output size is not known in advance,
                // and the quota is reconciled when it reports back.
                maxBytes: Math.max(Number(row.size_bytes) * 2, 32 * 1024 * 1024),
                expiresInSeconds: CLAIM_MINUTES * 60,
              }),
            },
            thumb: row.thumb_key
              ? null
              : {
                  contentType: IMAGE_MIME.jpeg,
                  upload: await storage.presignUpload({
                    key: thumbKey(row.event_id, row.id, IMAGE_EXT.jpeg),
                    contentType: IMAGE_MIME.jpeg,
                    maxBytes: 4 * 1024 * 1024,
                    expiresInSeconds: CLAIM_MINUTES * 60,
                  }),
                },
            poster:
              isVideo && !row.poster_key
                ? {
                    contentType: IMAGE_MIME.jpeg,
                    upload: await storage.presignUpload({
                      key: posterKey(row.event_id, row.id, IMAGE_EXT.jpeg),
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
  displayBytes: z.number().int().nonnegative().optional(),
  thumbBytes: z.number().int().nonnegative().optional(),
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
       * A failed conversion is not a lost file. The original is untouched and
       * still downloadable; the row is marked so it stops being retried
       * forever and so an operator can see it.
       */
      console.error("[transcode] failed", body.mediaId, body.error);
      await admin
        .from("media")
        .update({ processing: "failed" })
        .eq("id", media.id);
      return ok({ recorded: true });
    }

    const isVideo = media.kind === "video";
    const newDisplayKey = isVideo
      ? displayKey(media.event_id, media.id, UNIVERSAL_VIDEO_FORMAT)
      : displayKey(media.event_id, media.id, IMAGE_EXT.jpeg);

    const displayBytes = body.displayBytes ?? 0;
    const thumbBytes = body.thumbBytes ?? 0;
    const posterBytes = body.posterBytes ?? 0;

    const wroteThumb = !media.thumb_key && thumbBytes > 0;
    const wrotePoster = isVideo && !media.poster_key && posterBytes > 0;

    // The worker's output was never reserved at upload time, so it is charged
    // to the event now. Storage cannot be reserved before its size is known.
    const added =
      displayBytes -
      Number(media.display_size_bytes) +
      (wroteThumb ? thumbBytes : 0) +
      (wrotePoster ? posterBytes : 0);

    if (added > 0) {
      const { data: reserved } = await admin.rpc("reserve_storage", {
        p_event: media.event_id,
        p_bytes: added,
      });
      if (!reserved) {
        /*
         * The event filled up between upload and conversion. Keep the original,
         * drop what the worker wrote, and leave the row usable rather than
         * silently pushing the host over their quota.
         */
        await storage.remove([newDisplayKey]);
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
        display_key: displayBytes > 0 ? newDisplayKey : media.display_key,
        display_size_bytes: displayBytes,
        display_format: displayBytes > 0
          ? (isVideo ? UNIVERSAL_VIDEO_FORMAT : "jpeg")
          : media.display_format,
        thumb_key: wroteThumb
          ? thumbKey(media.event_id, media.id, IMAGE_EXT.jpeg)
          : media.thumb_key,
        thumb_size_bytes: wroteThumb ? thumbBytes : media.thumb_size_bytes,
        thumb_format: wroteThumb ? "jpeg" : media.thumb_format,
        poster_key: wrotePoster
          ? posterKey(media.event_id, media.id, IMAGE_EXT.jpeg)
          : media.poster_key,
        poster_size_bytes: wrotePoster ? posterBytes : media.poster_size_bytes,
        width: body.width ?? media.width,
        height: body.height ?? media.height,
        duration_seconds: body.durationSeconds ?? media.duration_seconds,
        processing: "done",
      })
      .eq("id", media.id);

    return ok({ recorded: true });
  });
}
