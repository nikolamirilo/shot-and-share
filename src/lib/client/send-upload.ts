"use client";

import type { Prepared } from "@/lib/client/prepare";
import {
  UploadError,
  postJson,
  uploadToPresigned,
  withRetry,
} from "@/lib/client/upload";
import type { PresignedUpload } from "@/lib/storage/types";

interface PresignResponse {
  upload: {
    mediaId: string;
    source: "file" | "compressed";
    media: PresignedUpload;
    thumb?: PresignedUpload | null;
    poster?: PresignedUpload | null;
  };
}

export interface UploadEndpoints {
  presign: string;
  confirm: string;
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

  const thumbBytes = upload.thumb && prepared.thumb ? prepared.thumb.size : 0;
  const posterBytes = upload.poster && prepared.poster ? prepared.poster.size : 0;
  const totalBytes = Math.max(1, body.size + thumbBytes + posterBytes);

  let sentBytes = 0;
  let peak = 0;
  const report = (loadedNow: number) => {
    if (!onProgress) return;
    peak = Math.max(peak, Math.min(1, (sentBytes + loadedNow) / totalBytes));
    onProgress(peak);
  };

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
    await withRetry(() =>
      uploadToPresigned(upload.media, body, (fraction) =>
        report(fraction * body.size),
      ),
    );
    sentBytes += body.size;
    report(0);

    if (upload.thumb && prepared.thumb) {
      try {
        await uploadToPresigned(upload.thumb, prepared.thumb, (fraction) =>
          report(fraction * thumbBytes),
        );
        thumbUploaded = true;
      } catch (e) {
        console.error("[upload] thumbnail failed, keeping the photo", e);
      }
      sentBytes += thumbBytes;
      report(0);
    }

    if (upload.poster && prepared.poster) {
      try {
        await uploadToPresigned(upload.poster, prepared.poster, (fraction) =>
          report(fraction * posterBytes),
        );
        posterUploaded = true;
      } catch (e) {
        console.error("[upload] poster failed, keeping the clip", e);
      }
      sentBytes += posterBytes;
      report(0);
    }
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await confirm({
      mediaUploaded: false,
      thumbUploaded: false,
      posterUploaded: false,
      failed: true,
      reason: reason.slice(0, 300),
    }).catch(() => {
    });
    throw e;
  }

  const confirmation = await withRetry(() =>
    confirm({ mediaUploaded: true, thumbUploaded, posterUploaded, failed: false }),
  );

  if (!confirmation.confirmed) {
    throw new UploadError("The host's gallery would not accept it.");
  }

  return { mediaId: upload.mediaId, confirmation };
}
