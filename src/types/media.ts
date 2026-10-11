import type { MediaRow } from "@/types/db";

/**
 * One photograph or clip, as everything that renders it wants to see it.
 *
 * Pure data in a pure module: client components import this, so it must not
 * live anywhere that pulls in `server-only`. The server-side builder that
 * produces one of these is @/lib/media/view.
 */
export interface MediaView {
  id: string;
  kind: MediaRow["kind"];
  width: number | null;
  height: number | null;
  createdAt: string;
  /**
   * When it was taken, or when it arrived if the device did not say - the
   * order of the "time taken" sort. See migration 0024.
   */
  takenAt: string;
  uploaderFingerprint: string | null;
  sizeBytes: number;
  /**
   * What a grid shows: for a photo its stored thumbnail, falling back to the
   * full copy when there is not one, and for a video its poster frame.
   */
  previewUrl: string | null;
  fullUrl: string | null;
  posterUrl: string | null;
  durationSeconds: number | null;
  processing: boolean;
  url?: string;
  downloadUrl?: string;
  format: string | null;
  review?: {
    state: "held" | "reported";
    labels: string[];
    reports: number;
  };
}
