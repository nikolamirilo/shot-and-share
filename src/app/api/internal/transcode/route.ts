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
import { REPLACEABLE_CACHE_CONTROL } from "@/lib/storage/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const CLAIM_MINUTES = 20;

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

        const scope = scopeOfMedia(row);
        const outKey = mediaKey(
          scope,
          row.kind,
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
            media: {
              contentType: outMime,
              upload: await storage.presignUpload({
                key: outKey,
                contentType: outMime,
                // Generous, and reconciled when the worker reports back: H.264 at the
                // source's dimensions needs more bytes than the HEVC it came from.
                maxBytes: Math.max(Number(row.size_bytes) * 3, 32 * 1024 * 1024),
                expiresInSeconds: CLAIM_MINUTES * 60,
                /**
                 * The worker replaces the object in the bucket, so this key is not
                 * immutable.
                 */
                cacheControl: REPLACEABLE_CACHE_CONTROL,
              }),
            },
            thumb: isVideo
              ? null
              : {
                  contentType: IMAGE_MIME.webp,
                  upload: await storage.presignUpload({
                    key: thumbKey(scope, row.id, IMAGE_EXT.webp),
                    contentType: IMAGE_MIME.webp,
                    maxBytes: 1024 * 1024,
                    expiresInSeconds: CLAIM_MINUTES * 60,
                    cacheControl: REPLACEABLE_CACHE_CONTROL,
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
                      cacheControl: REPLACEABLE_CACHE_CONTROL,
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

const completeSchema = z.object({
  mediaId: z.string().uuid(),
  ok: z.boolean(),
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
      console.error("[transcode] failed", body.mediaId, body.error);
      await admin
        .from("media")
        .update({ processing: "failed" })
        .eq("id", media.id);
      return ok({ recorded: true });
    }

    const isVideo = media.kind === "video";
    const scope = scopeOfMedia(media);
    const newKey = mediaKey(
      scope,
      media.kind,
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

    const added =
      (replaced ? mediaBytes - Number(media.size_bytes) : 0) +
      (wroteThumb ? thumbBytes - Number(media.thumb_size_bytes) : 0) +
      (wrotePoster ? posterBytes : 0);

    if (!(await adjust(media.event_id, added))) {
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

    if (replaced && newKey !== media.media_key) {
      await storage.remove([media.media_key]);
    }
    if (wroteThumb && media.thumb_key && media.thumb_key !== newThumbKey) {
      await storage.remove([media.thumb_key]);
    }

    await screenLate(media.id, media.event_id, {
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

async function screenLate(
  mediaId: string,
  eventId: string,
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
    const admin = createAdminClient();

    const { data: event } = await admin
      .from("events")
      .select("auto_scan")
      .eq("id", eventId)
      .maybeSingle();

    if (!event?.auto_scan) return;

    const review = await decideReview({ key, requireApproval: false, autoScan: true });
    if (!review.moderated_at) return;

    await admin
      .from("media")
      .update(review)
      .eq("id", mediaId)
      .eq("review_state", "approved")
      .is("moderated_at", null);
  } catch (error) {
    console.error("[transcode] late screening failed", mediaId, error);
  }
}
