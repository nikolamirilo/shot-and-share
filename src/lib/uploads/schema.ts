import { z } from "zod";

import { MAX_POSTER_BYTES, MAX_THUMB_BYTES } from "@/lib/media/accept";

/** A copy the browser produced from the file the guest picked. */
export const renditionSchema = z.object({
  size: z.number().int().positive(),
  format: z.enum(["webp", "jpeg", "avif", "png"]),
  width: z.number().int().positive().max(60_000).optional(),
  height: z.number().int().positive().max(60_000).optional(),
});

const dimension = z.number().int().positive().max(60_000).optional().nullable();

/**
 * What the browser says about one file.
 *
 * `type` may be empty, because empty is what a great many pickers report. The
 * type is evidence about the file, not a promise: what decides how the object
 * is stored is the rendition the browser produced, if it managed one.
 */
export const fileSchema = z.object({
  size: z.number().int().positive(),
  type: z.string().max(120),
  compressed: renditionSchema.optional().nullable(),
  /** The small copy for the grid. Absent when the browser could not decode. */
  thumb: renditionSchema
    .extend({ size: z.number().int().positive().max(MAX_THUMB_BYTES) })
    .optional()
    .nullable(),
  sourceWidth: dimension,
  sourceHeight: dimension,
  /** The browser could not decode it; the worker has to finish the job. */
  needsServer: z.boolean().default(false),
});

/** The guest side adds a video's poster frame and its duration. */
export const guestFileSchema = fileSchema.extend({
  poster: renditionSchema
    .extend({ size: z.number().int().positive().max(MAX_POSTER_BYTES) })
    .optional()
    .nullable(),
  durationSeconds: z.number().nonnegative().max(86_400).optional().nullable(),
  /**
   * When it was taken, by the guest's own device: the EXIF date, or the file's
   * modified time. Only ever used to order the wall.
   */
  takenAt: z.string().datetime({ offset: true }).optional().nullable(),
});

/**
 * A capture time worth sorting by, or null.
 *
 * A phone with its clock at the factory default says 1970 or 2000, and one set
 * a year ahead says next summer; either would pin a photo to one end of the
 * wall for ever. Anything outside a sane window reads as "no date", and the
 * photo sorts by when it arrived instead.
 */
export function plausibleTakenAt(
  value: string | null | undefined,
  now = Date.now(),
): string | null {
  if (!value) return null;
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return null;
  const DAY = 86_400_000;
  if (at < Date.UTC(2000, 0, 2) || at > now + DAY) return null;
  return new Date(at).toISOString();
}

export const shareTokenSchema = z.string().min(20).max(64);
export const fingerprintSchema = z.string().min(8).max(64);

export type UploadedFile = z.infer<typeof fileSchema>;
export type GuestUploadedFile = z.infer<typeof guestFileSchema>;
