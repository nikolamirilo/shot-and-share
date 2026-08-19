import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { fail, handle, ok, parseBody } from "@/lib/api";
import { findMediaAnyStatus, listPendingProcessing } from "@/lib/db/media-repo";
import {
  IMAGE_EXT,
  IMAGE_MIME,
  UNIVERSAL_VIDEO_FORMAT,
  VIDEO_MIME,
} from "@/lib/media/formats";
import { mediaKey, posterKey, scopeOfMedia, thumbKey } from "@/lib/media";
import { decideReview, screenableKey } from "@/lib/moderation/review";
import { storage } from "@/lib/storage";
import { adjust } from "@/lib/storage/quota";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The transcode worker's API. It handles the two things a browser cannot:
 * images it could not decode (chiefly HEIC outside Safari), and video, where
 * client-side compression means MediaRecorder re-encoding in real time.
 *
 * The worker never gets AWS credentials - it asks for jobs, receives presigned
 * URLs, and reports back. ffmpeg parsing a hostile file is a real attack
 * surface, and this is the process most likely to be compromised, so it holds
 * nothing worth stealing.
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
    const rows = await listPendingProcessing(createAdminClient(), limit);

    const jobs = await Promise.all(
      rows.map(async (row) => {
        const isVideo = row.kind === "video";

        // Decided here, not by the worker: it must not choose where in the
        // bucket it writes. The scope comes off the row, so an output can only
        // land in the folder of the host who owns the photo.
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
                // and the quota is reconciled when it reports back. Three times
                // rather than two because video keeps its original dimensions
                // now - an iPhone clip is HEVC, H.264 at the same size needs
                // more bytes for the same picture, and a ceiling the output
                // does not fit under fails the job and leaves the guest holding
                // a file that Chrome cannot play.
                maxBytes: Math.max(Number(row.size_bytes) * 3, 32 * 1024 * 1024),
                expiresInSeconds: CLAIM_MINUTES * 60,
              }),
            },
            /*
             * Only for a photo. A clip's poster frame is already its small
             * copy, and it is signed just below when the browser could not cut
             * one.
             */
            thumb: isVideo
              ? null
              : {
                  contentType: IMAGE_MIME.webp,
                  upload: await storage.presignUpload({
                    key: thumbKey(scope, row.id, IMAGE_EXT.webp),
                    contentType: IMAGE_MIME.webp,
                    maxBytes: 1024 * 1024,
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

    const media = await findMediaAnyStatus(admin, body.mediaId);
    if (!media) return fail("not_found", "No such media row.");

    if (!body.ok) {
      // A failed conversion is not a lost file: what the guest uploaded is
      // untouched. The row is marked so it stops being retried forever.
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
    const thumbBytes = body.thumbBytes ?? 0;
    const posterBytes = body.posterBytes ?? 0;
    const replaced = mediaBytes > 0;
    const wroteThumb = !isVideo && thumbBytes > 0;
    const wrotePoster = isVideo && !media.poster_key && posterBytes > 0;
    const newThumbKey = thumbKey(scope, media.id, IMAGE_EXT.webp);

    // The converted file replaces the upload, so the folder never holds both.
    // The delta is usually negative. Reserving cannot happen before the size
    // is known. A rewritten thumbnail replaces its predecessor at the same key,
    // so only the difference is charged.
    const added =
      (replaced ? mediaBytes - Number(media.size_bytes) : 0) +
      (wroteThumb ? thumbBytes - Number(media.thumb_size_bytes) : 0) +
      (wrotePoster ? posterBytes : 0);

    if (!(await adjust(media.event_id, added))) {
      // The event filled up between upload and conversion. Keep what the guest
      // uploaded, drop what the worker wrote, and leave the row usable rather
      // than silently pushing the host over their quota.
      if (newKey !== media.media_key) await storage.remove([newKey]);
      if (wroteThumb && newThumbKey !== media.thumb_key) {
        await storage.remove([newThumbKey]);
      }
      await admin
        .from("media")
        .update({ processing: "failed" })
        .eq("id", media.id);
      return ok({ recorded: true, skipped: "quota" });
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
        thumb_key: wroteThumb ? newThumbKey : media.thumb_key,
        thumb_size_bytes: wroteThumb ? thumbBytes : media.thumb_size_bytes,
        thumb_format: wroteThumb ? "webp" : media.thumb_format,
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

    // Only once the row points at the new object. A HEIC becomes a JPEG and a
    // MOV an MP4, so the key changes and the old object would otherwise be paid
    // for and never read. After the update, so a failure here leaves a stray
    // object rather than a broken photo.
    if (replaced && newKey !== media.media_key) {
      await storage.remove([media.media_key]);
    }

    await screenLate(media.id, {
      moderated_at: media.moderated_at,
      kind: media.kind,
      media_key: replaced ? newKey : media.media_key,
      poster_key: wrotePoster
        ? posterKey(scope, media.id, IMAGE_EXT.jpeg)
        : media.poster_key,
    });

    return ok({ recorded: true });
  });
}

/**
 * The second chance to screen a photograph.
 *
 * A HEIC from desktop Chrome reaches the bucket in a format Rekognition cannot
 * read, so it arrives unscreened and stays visible - the deliberate fail-open.
 * The worker has just written a JPEG of it, which is the first copy anything
 * could look at, so this is where that upload finally gets checked.
 *
 * Only rows nobody has screened. A photograph the host has already looked at
 * and approved must not be pulled back down by a conversion job hours later.
 */
async function screenLate(
  mediaId: string,
  row: {
    moderated_at: string | null;
    kind: string;
    media_key: string;
    poster_key: string | null;
  },
) {
  if (row.moderated_at) return;

  const key = screenableKey(row);
  if (!key) return;

  try {
    /* requireApproval is false on purpose. The event's hold-everything switch
       was already applied when the row was written; asking again here would
       hold a photograph the host has released. */
    const review = await decideReview({ key, requireApproval: false });
    if (!review.moderated_at) return;

    await createAdminClient()
      .from("media")
      .update(review)
      .eq("id", mediaId)
      // Nothing the host has since acted on. Between the upload and now they
      // may have approved or a guest may have reported it, and this job is the
      // least informed party in either case.
      .eq("review_state", "approved")
      .is("moderated_at", null);
  } catch (error) {
    console.error("[transcode] late screening failed", mediaId, error);
  }
}
