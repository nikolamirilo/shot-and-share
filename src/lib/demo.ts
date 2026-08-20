import type { MediaView } from "@/lib/media-view";

/**
 * A gallery a stranger can open.
 *
 * Half of getting a payment application approved is a reviewer seeing a working
 * product inside ten seconds. Every button on this site went to /login, and the
 * pricing page's argument - that the free plan is a working product rather than
 * a demo - is a good answer for a customer and no answer at all for somebody
 * who is not going to create an account to check.
 *
 * So this is the guest page, rendered from the same components a real guest
 * gets, with photographs that ship in the repository. No database, no storage,
 * no seeding step, and nothing to go stale on a fresh deployment.
 *
 * The photographs are the ones already used by the hero, from Unsplash, with
 * their sources recorded in public/hero/variants/CREDITS.json. Using real
 * photographs of real parties rather than grey boxes is the point: a reviewer
 * is deciding whether this is a photo sharing product, and a wall of
 * placeholders answers that question the wrong way.
 */

export const DEMO_EVENT = {
  name: "Ana & Marko",
  /** Fixed, never `new Date()`: a demo that says "today" every day reads as fake. */
  date: "2026-06-13",
  message:
    "Thank you for coming. Everything you took tonight belongs here - add it whenever you like.",
} as const;

/** The frames in `public/hero/variants`, minus the two used as page fills. */
const FRAMES = [
  "01", "02", "03", "04", "05", "06",
  "07", "08", "09", "10", "11", "12",
] as const;

/**
 * Sizes the tiles actually mix.
 *
 * A wall where every photograph is the same shape looks like a template. Real
 * events are portrait phones and the occasional landscape, so the demo is too.
 */
const SHAPES: Array<[number, number]> = [
  [1600, 2000],
  [2000, 1500],
  [1500, 2000],
  [2000, 1333],
];

/**
 * The demo wall.
 *
 * Built as `MediaView` because that is what the real gallery renders, so the
 * demo cannot drift away from the product: a change to how a photograph is
 * displayed changes this page too, and a change that breaks it breaks here
 * first.
 */
export const DEMO_MEDIA: MediaView[] = FRAMES.map((frame, index) => {
  const [width, height] = SHAPES[index % SHAPES.length];
  const url = `/hero/variants/${frame}.jpg`;

  return {
    id: `demo-${frame}`,
    kind: "photo",
    width,
    height,
    /* Fixed timestamps, descending, so the order is the order of the array and
       the page renders identically on every request. */
    createdAt: `2026-06-13T2${index < 6 ? 1 : 0}:${String(59 - index * 5).padStart(2, "0")}:00.000Z`,
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
