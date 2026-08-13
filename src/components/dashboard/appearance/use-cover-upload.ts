"use client";

import { useState } from "react";

import { prepare } from "@/lib/client/prepare";
import { sendUpload } from "@/lib/client/send-upload";
import { UploadError } from "@/lib/client/upload";
import { deleteMedia } from "@/lib/actions/media";
import { formatBytes } from "@/lib/format";
import type { MediaView } from "@/lib/media-view";

/**
 * The host's own cover image, through the same handshake a guest's photo uses:
 * the browser shrinks it, the server signs a URL, the bytes go straight to the
 * bucket, and the row is written only once they are there.
 */
export function useCoverUpload({
  eventId,
  maxFileBytes,
  initial,
  onUploaded,
  onRemoved,
}: {
  eventId: string;
  maxFileBytes: number;
  initial: MediaView[];
  onUploaded: (item: MediaView) => void;
  onRemoved: (item: MediaView) => void;
}) {
  const [uploads, setUploads] = useState(initial);
  const [progress, setProgress] = useState<{
    name: string;
    percent: number;
  } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("A cover has to be an image rather than a video.");
      return;
    }
    if (file.size > maxFileBytes) {
      setError(
        `That image is bigger than ${formatBytes(maxFileBytes, 0)}, which is the most we can take in one file.`,
      );
      return;
    }

    setProgress({ name: file.name, percent: 0 });
    try {
      const prepared = await prepare(file);

      const { confirmation } = await sendUpload<{
        confirmed: boolean;
        item: MediaView | null;
      }>(
        {
          presign: `/api/events/${eventId}/cover/presign`,
          confirm: `/api/events/${eventId}/cover/confirm`,
        },
        file,
        prepared,
        (fraction) =>
          setProgress((prev) =>
            prev ? { ...prev, percent: Math.round(fraction * 100) } : prev,
          ),
      );

      if (!confirmation.item) {
        throw new UploadError("The image went up but could not be saved.");
      }

      const item = confirmation.item;
      setUploads((prev) => [item, ...prev]);
      onUploaded(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That image did not upload.");
    } finally {
      setProgress(null);
    }
  }

  async function remove(item: MediaView) {
    setError(null);
    setRemoving(item.id);

    const result = await deleteMedia(eventId, [item.id]).catch(() => ({
      error: "That did not delete. Check your connection and try again.",
    }));

    setRemoving(null);
    if (result.error) {
      setError(result.error);
      return;
    }

    setUploads((prev) => prev.filter((u) => u.id !== item.id));
    onRemoved(item);
  }

  return { uploads, upload, remove, progress, removing, error, setError };
}
