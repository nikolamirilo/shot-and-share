/**
 * How the page opens.
 *
 * Two shapes are gone, and both went for the same reason: they put the name
 * *beside* the photograph rather than on it, which on the phone every guest
 * actually holds is a small picture above a heading. "Framed" - a photo card
 * with the name next to it - went first, to `full`. "Band" - a photo above a
 * solid stripe of accent carrying the name - follows it, to `half`, which is
 * the same photograph at the same height with the name laid over it.
 *
 * What is left differs in how much of the phone the photograph gets before the
 * ask, which is the only question a cover answers: all of it, half of it, a
 * strip across the top, or none at all.
 */
export const COVER_VARIANTS = [
  {
    id: "full",
    name: "Full screen",
    hint: "The photo fills the phone, name across the bottom. The one that makes a guest stop.",
    needsImage: true,
  },
  {
    id: "classic",
    name: "Banner",
    hint: "Photo across the top, name over it. Guests reach the upload button without scrolling.",
    needsImage: true,
  },
  {
    id: "half",
    name: "Half screen",
    hint: "The photo takes half the phone, name over it. Full-screen looks with the ask still in view.",
    needsImage: true,
  },
  {
    id: "type",
    name: "Just type",
    hint: "No photo at all. Large type on the theme colour.",
    needsImage: false,
  },
] as const;

export type CoverVariant = (typeof COVER_VARIANTS)[number]["id"];
export const DEFAULT_COVER: CoverVariant = "full";

export function coerceCover(value: unknown): CoverVariant {
  return COVER_VARIANTS.some((v) => v.id === value)
    ? (value as CoverVariant)
    : DEFAULT_COVER;
}

/* -------------------------------------------------------------------------- */

/**
 * How the guest is asked for their photos.
 *
 * This is the one component on the page that has a job to do, so the variants
 * differ in shape and prominence rather than in decoration. Every one of them
 * keeps the same three things: one obvious action, the optional name field, and
 * the line saying what may be sent.
 */
export const UPLOAD_VARIANTS = [
  {
    id: "button",
    name: "Big button",
    hint: "One wide button on a card. Impossible to miss, and the safe one.",
  },
  {
    id: "panel",
    name: "Drop panel",
    hint: "A large dashed panel. Tap it on a phone, or drop files on it from a laptop.",
  },
  {
    id: "bar",
    name: "Slim bar",
    hint: "A compact row. Takes little height, so the gallery starts higher up.",
  },
  {
    id: "split",
    name: "Camera or library",
    hint: "Two buttons: take one now, or pick from the camera roll.",
  },
] as const;

export type UploadVariant = (typeof UPLOAD_VARIANTS)[number]["id"];
export const DEFAULT_UPLOAD: UploadVariant = "button";

export function coerceUpload(value: unknown): UploadVariant {
  return UPLOAD_VARIANTS.some((v) => v.id === value)
    ? (value as UploadVariant)
    : DEFAULT_UPLOAD;
}

/* -------------------------------------------------------------------------- */
