import type { MediaRow } from "@/lib/db/types";

/**
 * One photograph or clip, as everything that renders it wants to see it.
 *
 * Pure data in a pure module: client components import this, so it must not
 * live anywhere that pulls in `server-only`.
 */
export interface MediaView {
  id: string;
  kind: MediaRow["kind"];
  width: number | null;
  height: number | null;
  createdAt: string;
  uploaderName: string | null;
  uploaderFingerprint: string | null;
  sizeBytes: number;
  /**
   * What a grid shows: for a photo the stored image itself - there is no
   * separate thumbnail - and for a video its poster frame.
   */
  previewUrl: string | null;
  /** Poster frame for a video, so a grid never shows a grey box. */
  posterUrl: string | null;
  durationSeconds: number | null;
  /** True while the worker still owes this file a viewable copy. */
  processing: boolean;
  /**
   * The stored object behind a short-lived signature, resolved only when
   * something is opened. What a video plays from and Download points at.
   */
  url?: string;
  /**
   * The same object, signed to come back as an attachment. A browser ignores
   * `download` on a cross-origin link, so only the bucket sending
   * Content-Disposition actually saves the file.
   */
  downloadUrl?: string;
  /** Format of the stored object. */
  format: string | null;
}

/**
 * How many photographs a page holds. Fifty is five waves of ten - see
 * useLoadQueue. Here rather than in a server module because the guest gallery
 * pages on the client and shares the number with the route that serves it.
 */
export const GALLERY_PAGE_SIZE = 50;
