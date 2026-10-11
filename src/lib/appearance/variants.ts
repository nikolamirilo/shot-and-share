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

export const COVER_VERTICALS = [
  { id: "top", name: "Top", hint: "Along the top, clear of anyone standing in the lower half." },
  { id: "middle", name: "Middle", hint: "Across the middle. For a wide shot with room above the people." },
  { id: "bottom", name: "Bottom", hint: "The foot of the photo. The one every event has today." },
] as const;

export type CoverVertical = (typeof COVER_VERTICALS)[number]["id"];

export const COVER_HORIZONTALS = [
  { id: "left", name: "Left", hint: "Hung off the left edge." },
  { id: "centre", name: "Centre", hint: "Centred. Formal, and kinder to short names." },
  { id: "right", name: "Right", hint: "Hung off the right edge." },
] as const;

export type CoverHorizontal = (typeof COVER_HORIZONTALS)[number]["id"];

export type CoverPosition = `${CoverVertical}-${CoverHorizontal}`;

export const COVER_POSITIONS: {
  id: CoverPosition;
  name: string;
  vertical: CoverVertical;
  horizontal: CoverHorizontal;
}[] = COVER_VERTICALS.flatMap((v) =>
  COVER_HORIZONTALS.map((h) => ({
    id: `${v.id}-${h.id}` as CoverPosition,
    name: `${v.name} ${h.name.toLowerCase()}`,
    vertical: v.id,
    horizontal: h.id,
  })),
);

export const DEFAULT_POSITION: CoverPosition = "bottom-left";

const LEGACY_POSITIONS: Record<string, CoverPosition> = {
  centre: "middle-centre",
};

export function coercePosition(value: unknown): CoverPosition {
  if (typeof value !== "string") return DEFAULT_POSITION;
  if (COVER_POSITIONS.some((p) => p.id === value)) return value as CoverPosition;
  return LEGACY_POSITIONS[value] ?? DEFAULT_POSITION;
}

export function splitPosition(value: CoverPosition): {
  vertical: CoverVertical;
  horizontal: CoverHorizontal;
} {
  const [vertical, horizontal] = value.split("-") as [
    CoverVertical,
    CoverHorizontal,
  ];
  return { vertical, horizontal };
}

export function joinPosition(
  vertical: CoverVertical,
  horizontal: CoverHorizontal,
): CoverPosition {
  return `${vertical}-${horizontal}`;
}

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
