"use client";

import type { Prepared } from "@/lib/client/prepare";
import {
  UploadError,
  postJson,
  uploadToPresigned,
  withRetry,
} from "@/lib/client/upload";
import type { PresignedUpload } from "@/lib/storage/types";

/**
 * One file, from presign to written row.
 *
 * The guest uploader and the host's cover picker each had their own copy of
 * this - the same four steps, the same rollback, the same retry policy - and
 * they had already drifted on which failures hand the reserved bytes back.
 */

interface PresignResponse {
  upload: {
    mediaId: string;
    /** "compressed" means send the re-encoded copy, not the file off the disk. */
    source: "file" | "compressed";
    media: PresignedUpload;
    thumb?: PresignedUpload | null;
    poster?: PresignedUpload | null;
  };
}

export interface UploadEndpoints {
  presign: string;
  confirm: string;
  /**
   * Fields sent with every request of this handshake. A guest carries their
   * share token and fingerprint; a host carries nothing, because the session
   * cookie is already doing that job.
   */
  identity?: Record<string, unknown>;
}

export interface SendResult<T> {
  mediaId: string;
  confirmation: T;
}

export async function sendUpload<T extends { confirmed: boolean }>(
  endpoints: UploadEndpoints,
  file: File,
  prepared: Prepared,
  onProgress?: (fraction: number) => void,
): Promise<SendResult<T>> {
  const identity = endpoints.identity ?? {};

  const { upload } = await withRetry(() =>
    postJson<PresignResponse>(endpoints.presign, {
      ...identity,
      file: prepared.descriptor,
    }),
  );

  const body =
    upload.source === "compressed" && prepared.compressed
      ? prepared.compressed
      : file;

  const confirm = (fields: Record<string, unknown>) =>
    postJson<T>(endpoints.confirm, {
      ...identity,
      mediaId: upload.mediaId,
      width: prepared.sourceWidth,
      height: prepared.sourceHeight,
      ...fields,
    });

  let posterUploaded = false;
  let thumbUploaded = false;

  try {
    await withRetry(() => uploadToPresigned(upload.media, body, onProgress));

    /*
     * Neither of the small copies may cost the photograph. A thumbnail that
     * fails means the grid falls back to the full copy through the optimiser;
     * a poster that fails means the worker cuts another one.
     *
     * Both are logged rather than swallowed: one failing at every event is a
     * bucket problem, and a silent catch is how it stays invisible for a month.
     */
    if (upload.thumb && prepared.thumb) {
      try {
        await uploadToPresigned(upload.thumb, prepared.thumb);
        thumbUploaded = true;
      } catch (e) {
        console.error("[upload] thumbnail failed, keeping the photo", e);
      }
    }

    if (upload.poster && prepared.poster) {
      try {
        await uploadToPresigned(upload.poster, prepared.poster);
        posterUploaded = true;
      } catch (e) {
        console.error("[upload] poster failed, keeping the clip", e);
      }
    }
  } catch (e) {
    /*
     * Hand the reserved space back before giving up, so a failed upload does
     * not sit on the host's quota until the nightly sweep - and say why,
     * because this is the only report the operator will ever get. The bytes
     * never touched our servers, so without this a bucket that refuses every
     * upload in the country is indistinguishable from one guest's phone losing
     * signal.
     */
    const reason = e instanceof Error ? e.message : String(e);
    await confirm({
      mediaUploaded: false,
      thumbUploaded: false,
      posterUploaded: false,
      failed: true,
      reason: reason.slice(0, 300),
    }).catch(() => {
      /* the sweep is the backstop */
    });
    throw e;
  }

  /*
   * The bytes are in the bucket. Confirming is what turns them into a photo, so
   * it is worth retrying hard: losing the picture because a four hundred byte
   * acknowledgement did not get through would be the worst trade in the system.
   */
  const confirmation = await withRetry(() =>
    confirm({ mediaUploaded: true, thumbUploaded, posterUploaded, failed: false }),
  );

  if (!confirmation.confirmed) {
    throw new UploadError("The host's gallery would not accept it.");
  }

  return { mediaId: upload.mediaId, confirmation };
}
