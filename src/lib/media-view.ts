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
  uploaderFingerprint: string | null;
  sizeBytes: number;
  /**
   * What a grid shows: for a photo its stored thumbnail, falling back to the
   * full copy when there is not one, and for a video its poster frame.
   */
  previewUrl: string | null;
  /**
   * The full-size copy, for the one or two places that show a photograph
   * large: the lightbox and the Stack layout. Still through the optimiser, not
   * raw - the stored file is a couple of megabytes.
   */
  fullUrl: string | null;
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
