import { type MediaView } from "@/types/media";

export const DEMO_EVENT = {
  name: "Romeo & Juliet",
  message:
    "Thank you for coming. Everything you took tonight belongs here - add it whenever you like.",
} as const;

const FRAMES = [
  "01", "02", "03", "04", "05", "06",
  "07", "08", "09", "10", "11", "12",
] as const;

const SHAPES: Array<[number, number]> = [
  [1600, 2000],
  [2000, 1500],
  [1500, 2000],
  [2000, 1333],
];

export const DEMO_MEDIA: MediaView[] = FRAMES.map((frame, index) => {
  const [width, height] = SHAPES[index % SHAPES.length];
  const url = `/hero/variants/${frame}.jpg`;

  const createdAt = `2026-06-13T2${index < 6 ? 1 : 0}:${String(59 - index * 5).padStart(2, "0")}:00.000Z`;

  return {
    id: `demo-${frame}`,
    kind: "photo",
    width,
    height,
    createdAt,
    takenAt: createdAt,
    uploaderFingerprint: null,
    sizeBytes: 2_400_000,
    previewUrl: url,
    fullUrl: url,
    posterUrl: null,
    durationSeconds: null,
    processing: false,
    format: "jpeg",
  };
});
