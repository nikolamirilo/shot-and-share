import type { MediaRow } from "@/lib/db/types";

/**
 * One photograph or clip, as everything that renders it wants to see it.
 *
 * The app's central view type, and it used to be declared inside
 * @/lib/events - a module whose first line is `import "server-only"`. Four
 * client components import it, and that worked only because they all happened
 * to write `import type`, which TypeScript erases before the bundler sees it.
 * One `import { }` without the `type` and the build breaks in a way that reads
 * as unrelated. It is pure data, so it lives somewhere pure.
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
   * What a grid shows. For a photo this is the stored image itself - there is
   * no separate thumbnail any more, because a compressed photo is already
   * small enough that a second copy of it was costing storage to save nothing.
   * For a video it is the poster frame.
   */
  previewUrl: string | null;
  /** Poster frame for a video, so a grid never shows a grey box. */
  posterUrl: string | null;
  durationSeconds: number | null;
  /** True while the worker still owes this file a viewable copy. */
  processing: boolean;
  /**
   * The stored object behind a short-lived signature, resolved only when
   * something is actually opened. It is what a video plays from and what the
   * Download button points at.
   */
  url?: string;
  /**
   * The same object, signed to come back as an attachment. A browser ignores
   * the `download` attribute on a link to another origin, so the only thing
   * that actually saves the file instead of opening it is the bucket sending
   * Content-Disposition itself.
   */
  downloadUrl?: string;
  /** Format of the stored object. */
  format: string | null;
}

/**
 * How many photographs a page of the gallery holds. Here rather than in the
 * server module because the guest gallery pages on the client and could not
 * otherwise share the number with the route that serves it.
 *
 * Fifty, which is five waves of ten - the gallery loads a page ten photographs
 * at a time, in order, rather than asking for all of them at once.
 */
export const GALLERY_PAGE_SIZE = 50;
