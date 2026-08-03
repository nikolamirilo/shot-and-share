/**
 * Plans.
 *
 * Names come from the cheese world and encode the size of the thing you are
 * buying, which is more useful than Basic / Pro / Premium.
 *
 * The unit is gigabytes, not photo counts. A count limit punishes people with
 * modern phones and rewards nobody; gigabytes are what actually cost money and
 * they let us look far more generous for the same spend.
 */

export const GB = 1024 ** 3;
export const MB = 1024 ** 2;

/** 4 MB average photo. HEIC runs ~2 MB, a 12 MP JPEG ~4 MB. Conservative. */
export const AVG_PHOTO_BYTES = 4 * MB;

export type TierId = "free" | "event" | "wedding";

export interface Tier {
  id: TierId;
  /** The name on the pricing page. */
  name: string;
  /** What it is, in one line. */
  meaning: string;
  priceEur: number;
  quotaBytes: number;
  /** Days the photos are kept, counted from the event date. */
  retentionDays: number;
  /** Video is off on free entirely: one 500 MB clip eats half the tier. */
  video: boolean;
  /** Hard per-file ceiling. A cost control, not a feature limit. */
  maxFileBytes: number;
  bulkZip: boolean;
  cleanQr: boolean;
  brandedQr: boolean;
  customPage: boolean;
  slideshow: boolean;
  albums: boolean;
  prioritySupport: boolean;
}

export const TIERS: Record<TierId, Tier> = {
  free: {
    id: "free",
    name: "Taste",
    meaning: "Free. A sample.",
    priceEur: 0,
    quotaBytes: 1 * GB,
    retentionDays: 30,
    video: false,
    maxFileBytes: 50 * MB,
    bulkZip: true,
    cleanQr: true,
    brandedQr: false,
    customPage: false,
    slideshow: false,
    albums: false,
    prioritySupport: false,
  },
  event: {
    id: "event",
    name: "Slice",
    meaning: "One event.",
    priceEur: 19,
    quotaBytes: 10 * GB,
    retentionDays: 183,
    video: true,
    maxFileBytes: 200 * MB,
    bulkZip: true,
    cleanQr: true,
    brandedQr: false,
    customPage: true,
    slideshow: false,
    albums: false,
    prioritySupport: false,
  },
  wedding: {
    id: "wedding",
    name: "Wheel",
    meaning: "The whole thing.",
    priceEur: 39,
    quotaBytes: 30 * GB,
    retentionDays: 365,
    video: true,
    maxFileBytes: 200 * MB,
    bulkZip: true,
    cleanQr: true,
    brandedQr: true,
    customPage: true,
    slideshow: true,
    albums: true,
    prioritySupport: true,
  },
};

/**
 * Keep Forever. Paid once, never again.
 *
 * The Wedding tier deliberately stops at 12 months. If retention were unlimited
 * this add-on would have no job to do. Twelve months is long enough to feel
 * generous next to a 90-day competitor and short enough that the upsell matters.
 */
export const KEEP_FOREVER = {
  id: "keep_forever" as const,
  name: "The Cellar",
  meaning: "Where cheese is aged, so where photos are kept for good.",
  priceEur: 29,
};

export type PurchasableId = TierId | typeof KEEP_FOREVER.id;

export const TIER_ORDER: TierId[] = ["free", "event", "wedding"];

export function getTier(id: string | null | undefined): Tier {
  return TIERS[(id as TierId) ?? "free"] ?? TIERS.free;
}

export function isUpgrade(from: TierId, to: TierId): boolean {
  return TIER_ORDER.indexOf(to) > TIER_ORDER.indexOf(from);
}

/** Rough photo count for a byte budget. Used for copy, never for enforcement. */
export function approxPhotos(bytes: number): number {
  return Math.round(bytes / AVG_PHOTO_BYTES);
}

/**
 * Expiry is measured from the event date, not the purchase date. A host who
 * buys six months ahead of the wedding should not lose half their window.
 */
export function computeExpiry(eventDate: string | Date, tier: TierId): Date {
  const base = new Date(eventDate);
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + TIERS[tier].retentionDays);
  return d;
}

/** The single largest cost line in the system, so it is capped, not left open. */
export const MAX_ARCHIVE_BUILDS = 3;

/** Warning emails go out this many days before an event expires. */
export const RETENTION_WARNING_DAYS = [14, 7, 1];

/**
 * Expired events are soft-deleted first and hard-deleted only after this grace
 * period. Losing someone's wedding photos to a scheduling bug is the failure
 * this product cannot survive, so the destructive step is always last and
 * always delayed.
 */
export const HARD_DELETE_GRACE_DAYS = 14;
