/**
 * Plans.
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

/**
 * The name a plan answers to in code. Fixed forever, and never written to a
 * row: `TIERS.pro` is what source files say, whatever the plan is called on
 * the pricing page this quarter.
 */
export type PlanKey = "free" | "plus" | "pro";

/**
 * Lemon Squeezy variant ids.
 *
 * `NEXT_PUBLIC_` because this module is imported by client components and
 * `@/lib/env` is server-only, so the ids cannot travel through it. Publishing
 * them costs nothing: a variant id is already visible in the checkout URL of
 * every purchase.
 *
 * Written out one static member access at a time rather than through a helper,
 * because the bundler only substitutes `process.env.NEXT_PUBLIC_X` when it can
 * see that exact expression. A dynamic lookup compiles to `undefined` in the
 * browser and fails silently.
 */
export const LS_VARIANTS = {
  plus: process.env.NEXT_PUBLIC_LS_VARIANT_PLUS || undefined,
  pro: process.env.NEXT_PUBLIC_LS_VARIANT_PRO || undefined,
  keep_forever: process.env.NEXT_PUBLIC_LS_VARIANT_KEEP_FOREVER || undefined,
} as const satisfies Record<string, string | undefined>;

export interface Tier {
  /**
   * What code refers to the plan by. Never stored on an event.
   */
  key: PlanKey;
  /**
   * The Lemon Squeezy variant id, and what `events.tier` holds.
   *
   * Falls back to the plan key when the variant is not configured, so a
   * developer without a Lemon Squeezy store still gets a stable value to write
   * and read back. It does mean a development row and a production row say
   * different things for the same plan - the accepted cost of keying rows on
   * an id that belongs to the payment provider rather than to us.
   */
  id: string;
  /**
   * Position in the ladder. Variant ids are opaque numbers that do not sort,
   * so upgrades are decided on this and nothing else.
   */
  rank: number;
  /** The name on the pricing page. */
  name: string;
  /** What it is, in one line. */
  meaning: string;
  priceEur: number;
  quotaBytes: number;
  /** Days the photos are kept, counted from the event date. */
  retentionDays: number;
  /** Video is off on Free entirely: one 500 MB clip eats half the tier. */
  video: boolean;
  /**
   * Hard per-file ceiling. A cost control, not a feature limit.
   *
   * In practice this is the video cap: a photo never comes near it, so the
   * plans differ in how long a clip they take, not in what a photo may be.
   */
  maxFileBytes: number;
  /**
   * How many files a guest may pick in one tap of the button.
   *
   * Anything past it is left out with a note saying so, never dropped
   * silently. Bigger plans take more, because a wedding guest emptying a
   * camera roll should not be doing it twenty at a time.
   */
  filesPerPick: number;
  bulkZip: boolean;
  cleanQr: boolean;
  brandedQr: boolean;
  customPage: boolean;
  slideshow: boolean;
  albums: boolean;
  prioritySupport: boolean;
}

export const TIERS: Record<PlanKey, Tier> = {
  free: {
    key: "free",
    // Free is not sold, so there is no variant to name it after.
    id: "free",
    rank: 0,
    name: "Free",
    meaning: "One look, nothing to pay.",
    priceEur: 0,
    quotaBytes: 1 * GB,
    retentionDays: 30,
    video: false,
    maxFileBytes: 50 * MB,
    filesPerPick: 20,
    bulkZip: true,
    cleanQr: true,
    brandedQr: false,
    customPage: false,
    slideshow: false,
    albums: false,
    prioritySupport: false,
  },
  plus: {
    key: "plus",
    id: LS_VARIANTS.plus ?? "plus",
    rank: 1,
    name: "Plus",
    meaning: "One event, done properly.",
    priceEur: 19,
    quotaBytes: 10 * GB,
    retentionDays: 183,
    video: true,
    maxFileBytes: 200 * MB,
    filesPerPick: 50,
    bulkZip: true,
    cleanQr: true,
    brandedQr: false,
    customPage: true,
    slideshow: false,
    albums: false,
    prioritySupport: false,
  },
  pro: {
    key: "pro",
    id: LS_VARIANTS.pro ?? "pro",
    rank: 2,
    name: "Pro",
    meaning: "The whole thing.",
    priceEur: 39,
    quotaBytes: 30 * GB,
    retentionDays: 365,
    video: true,
    maxFileBytes: 500 * MB,
    filesPerPick: 100,
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
 * The Pro tier deliberately stops at 12 months. If retention were unlimited
 * this add-on would have no job to do. Twelve months is long enough to feel
 * generous next to a 90-day competitor and short enough that the upsell matters.
 *
 * Unlike a tier this is never stored in `events.tier` - it is a boolean column
 * on the event - so it carries only a key and the variant to charge against.
 */
export const KEEP_FOREVER = {
  key: "keep_forever" as const,
  variantId: LS_VARIANTS.keep_forever,
  name: "Keep Forever",
  meaning: "Where the negatives go, so where photos are kept for good.",
  priceEur: 29,
};

/**
 * What can actually be bought.
 *
 * `PlanKey` includes "free", which nobody purchases - which is why four places
 * had each re-narrowed this by hand: a local `type Product` in the upgrade
 * panel, an inline union in the checkout action, a zod enum in the route, and
 * a dead `PurchasableId` in here that excluded nothing. One definition, and a
 * runtime list so the zod enum is derived rather than retyped.
 *
 * These are plan keys, not variant ids. A product travels as a request
 * parameter and inside Lemon Squeezy custom data, where a value that survives
 * changing stores is worth more than one that matches the row it will produce.
 */
export type PaidPlanKey = Exclude<PlanKey, "free">;
export type PurchasableId = PaidPlanKey | typeof KEEP_FOREVER.key;

export const PURCHASABLE_IDS = [
  "plus",
  "pro",
  "keep_forever",
] as const satisfies readonly PurchasableId[];

export const TIER_ORDER: PlanKey[] = ["free", "plus", "pro"];

/**
 * The largest pick any plan allows. Only the presign rate limit needs it -
 * see `LIMITS.presign` - and a test holds the two together.
 */
export const MAX_FILES_PER_PICK = Math.max(
  ...TIER_ORDER.map((key) => TIERS[key].filesPerPick),
);

/** Variant id back to the plan it pays for. Built once, not searched per call. */
const BY_ID = new Map<string, Tier>(
  TIER_ORDER.map((key) => [TIERS[key].id, TIERS[key]]),
);

/**
 * Resolve what an event row stores.
 *
 * The argument is a Lemon Squeezy variant id, so an unrecognised one is
 * ordinary rather than exceptional: it is what a row written against a
 * different store, or against a variant since replaced, looks like. Those fall
 * back to Free, which is the only safe direction to be wrong in.
 */
export function getTier(id: string | null | undefined): Tier {
  if (!id) return TIERS.free;
  return BY_ID.get(id) ?? TIERS.free;
}

/** True when moving from one stored tier id to another buys more, not less. */
export function isUpgrade(fromId: string, toId: string): boolean {
  return getTier(toId).rank > getTier(fromId).rank;
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
 *
 * Takes the plan rather than an id: every caller already holds one, and the id
 * is now a variant that would only have to be looked up again in here.
 */
export function computeExpiry(eventDate: string | Date, tier: Tier): Date {
  const base = new Date(eventDate);
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + tier.retentionDays);
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
