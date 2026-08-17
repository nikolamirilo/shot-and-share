/**
 * Plans.
 *
 * Names come from film and encode the size of the thing you are buying, which
 * is more useful than Basic / Pro / Premium. A frame is one picture, a roll is
 * an evening, a reel is the whole production.
 *
 * The unit is gigabytes, not photo counts. A count limit punishes people with
 * modern phones and rewards nobody; gigabytes are what actually cost money and
 * they let us look far more generous for the same spend.
 */

export const GB = 1024 ** 3;
export const MB = 1024 ** 2;

/**
 * What one stored photo actually costs, averaged over the phones people bring.
 *
 * 7 MB, not the 4 MB this was. Two things moved it: the stored copy is no
 * longer capped at 2560px, so a photo keeps every pixel it was taken with, and
 * a current flagship shoots 24-48MP rather than 12. A 48MP photo at full
 * resolution is around 9 MB; a 12MP one is around 2 MB. This sits between them
 * and leans high, because a count on a pricing page that turns out optimistic
 * is worse than one that turns out generous.
 */
export const AVG_PHOTO_BYTES = 7 * MB;

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
    name: "Frame",
    meaning: "Free. One look.",
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
    name: "Roll",
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
    name: "Reel",
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
  name: "The Archive",
  meaning: "Where the negatives go, so where photos are kept for good.",
  priceEur: 29,
};

/**
 * What can actually be bought.
 *
 * `TierId` includes "free", which nobody purchases - which is why four places
 * had each re-narrowed this by hand: a local `type Product` in the upgrade
 * panel, an inline union in the checkout action, a zod enum in the route, and
 * a dead `PurchasableId` in here that excluded nothing. One definition, and a
 * runtime list so the zod enum is derived rather than retyped.
 */
export type PaidTierId = Exclude<TierId, "free">;
export type PurchasableId = PaidTierId | typeof KEEP_FOREVER.id;

export const PURCHASABLE_IDS = [
  "event",
  "wedding",
  "keep_forever",
] as const satisfies readonly PurchasableId[];

export const TIER_ORDER: TierId[] = ["free", "event", "wedding"];

export function getTier(id: string | null | undefined): Tier {
  return TIERS[(id as TierId) ?? "free"] ?? TIERS.free;
}

export function isUpgrade(from: TierId, to: TierId): boolean {
  return TIER_ORDER.indexOf(to) > TIER_ORDER.indexOf(from);
}

/**
 * Rough photo count for a byte budget. Used for copy, never for enforcement.
 *
 * Rounded to two significant figures, because the input is an estimate and
 * "about 146 photos" claims a precision nobody measured. Small counts are left
 * alone - rounding 7 up to 10 would be a lie in the expensive direction.
 */
export function approxPhotos(bytes: number): number {
  const exact = bytes / AVG_PHOTO_BYTES;
  if (exact < 10) return Math.round(exact);
  const magnitude = 10 ** (Math.floor(Math.log10(exact)) - 1);
  return Math.round(exact / magnitude) * magnitude;
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
