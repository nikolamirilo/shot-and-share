import { z } from "zod";

import { MAX_POSTER_BYTES, MAX_THUMB_BYTES } from "@/lib/media/accept";

export const renditionSchema = z.object({
  size: z.number().int().positive(),
  format: z.enum(["webp", "jpeg", "avif", "png"]),
  width: z.number().int().positive().max(60_000).optional(),
  height: z.number().int().positive().max(60_000).optional(),
});

const dimension = z.number().int().positive().max(60_000).optional().nullable();

export const fileSchema = z.object({
  size: z.number().int().positive(),
  type: z.string().max(120),
  compressed: renditionSchema.optional().nullable(),
  thumb: renditionSchema
    .extend({ size: z.number().int().positive().max(MAX_THUMB_BYTES) })
    .optional()
    .nullable(),
  sourceWidth: dimension,
  sourceHeight: dimension,
  needsServer: z.boolean().default(false),
});

export const guestFileSchema = fileSchema.extend({
  poster: renditionSchema
    .extend({ size: z.number().int().positive().max(MAX_POSTER_BYTES) })
    .optional()
    .nullable(),
  durationSeconds: z.number().nonnegative().max(86_400).optional().nullable(),
  takenAt: z.string().datetime({ offset: true }).optional().nullable(),
});

/**
 * A phone with its clock at the factory default says 1970 or 2000, so implausible dates
 * are dropped.
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
