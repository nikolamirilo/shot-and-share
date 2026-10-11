import { formatCount } from "@/utils/format";

export const GB = 1024 ** 3;
export const MB = 1024 ** 2;

/** 7 MB: between a 12MP photo (~2 MB) and a 48MP one (~9 MB), leaning high. */
export const AVG_PHOTO_BYTES = 7 * MB;

export type PlanKey = "free" | "plus" | "pro";

/**
 * `NEXT_PUBLIC_` because this module is imported by client components, and
 * written out one static member access at a time because that is the only
 * form the bundler substitutes.
 */
export const CREEM_PRODUCTS = {
  plus: process.env.NEXT_PUBLIC_CREEM_PRODUCT_PLUS || undefined,
  pro: process.env.NEXT_PUBLIC_CREEM_PRODUCT_PRO || undefined,
  keeping_plus:
    process.env.NEXT_PUBLIC_CREEM_PRODUCT_KEEPING_PLUS || undefined,
  keeping_pro:
    process.env.NEXT_PUBLIC_CREEM_PRODUCT_KEEPING_PRO || undefined,
} as const satisfies Record<string, string | undefined>;

export interface Tier {
  key: PlanKey;
  /**
   * Falls back to the plan key when the product is not configured, so development and
   * production rows differ for the same plan.
   */
  id: string;
  /**
   * Product ids are opaque strings that do not sort, so upgrades are decided on this.
   */
  rank: number;
  name: string;
  meaning: string;
  priceEur: number;
  quotaBytes: number;
  retentionDays: number;
  video: boolean;
  maxFileBytes: number;
  bulkZip: boolean;
  cleanQr: boolean;
  customPage: boolean;
  slideshow: boolean;
}

export const TIERS: Record<PlanKey, Tier> = {
  free: {
    key: "free",
    // Free is not sold, so there is no product to name it after.
    id: "free",
    rank: 0,
    name: "Free",
    meaning: "One look, nothing to pay.",
    priceEur: 0,
    quotaBytes: 1 * GB,
    retentionDays: 30,
    video: false,
    maxFileBytes: 50 * MB,
    bulkZip: true,
    cleanQr: true,
    customPage: false,
    slideshow: false,
  },
  plus: {
    key: "plus",
    id: CREEM_PRODUCTS.plus ?? "plus",
    rank: 1,
    name: "Plus",
    meaning: "One event, done properly.",
    priceEur: 19,
    quotaBytes: 10 * GB,
    retentionDays: 183,
    video: true,
    maxFileBytes: 200 * MB,
    bulkZip: true,
    cleanQr: true,
    customPage: true,
    slideshow: false,
  },
  pro: {
    key: "pro",
    id: CREEM_PRODUCTS.pro ?? "pro",
    rank: 2,
    name: "Pro",
    meaning: "The whole thing.",
    priceEur: 39,
    quotaBytes: 30 * GB,
    retentionDays: 365,
    video: true,
    maxFileBytes: 500 * MB,
    bulkZip: true,
    cleanQr: true,
    customPage: true,
    slideshow: true,
  },
};

export interface Keeping {
  key: "keeping_plus" | "keeping_pro";
  productId: string | undefined;
  tier: PaidPlanKey;
  priceEur: number;
}

export const KEEPING: Record<PaidPlanKey, Keeping> = {
  plus: {
    key: "keeping_plus",
    productId: CREEM_PRODUCTS.keeping_plus,
    tier: "plus",
    priceEur: 5,
  },
  pro: {
    key: "keeping_pro",
    productId: CREEM_PRODUCTS.keeping_pro,
    tier: "pro",
    priceEur: 9,
  },
};

export const KEEPING_NAME = "Keep the photos";

export const KEEPING_DAYS = 365;

export function keepingFor(tier: Tier): Keeping | null {
  return tier.key === "free" ? null : KEEPING[tier.key];
}

export function isKeepingProduct(product: string): boolean {
  return product === "keeping_plus" || product === "keeping_pro";
}

export const VAT_NOTE =
  "Every price includes EU VAT. The number you see is the number you pay.";

export const VAT_BADGE = "VAT included";

export type PaidPlanKey = Exclude<PlanKey, "free">;
export type KeepingId = Keeping["key"];
export type PurchasableId = PaidPlanKey | KeepingId;

export const PURCHASABLE_IDS = [
  "plus",
  "pro",
  "keeping_plus",
  "keeping_pro",
] as const satisfies readonly PurchasableId[];

/**
 * `keep_forever` is absent on purpose: it can no longer be bought, but rows still hold
 * it.
 */
export const LEGACY_PRODUCTS = ["keep_forever"] as const;
export type LegacyProductId = (typeof LEGACY_PRODUCTS)[number];

export const TIER_ORDER: PlanKey[] = ["free", "plus", "pro"];

export const BIG_PICK = 300;

const BY_ID = new Map<string, Tier>(
  TIER_ORDER.map((key) => [TIERS[key].id, TIERS[key]]),
);

export function getTier(id: string | null | undefined): Tier {
  if (!id) return TIERS.free;
  return BY_ID.get(id) ?? TIERS.free;
}

export function isKnownTierId(id: string | null | undefined): boolean {
  return !id || BY_ID.has(id);
}

export function isUpgrade(fromId: string, toId: string): boolean {
  return getTier(toId).rank > getTier(fromId).rank;
}

export function approxPhotos(bytes: number): number {
  const exact = bytes / AVG_PHOTO_BYTES;
  if (exact < 10) return Math.round(exact);
  const magnitude = 10 ** (Math.floor(Math.log10(exact)) - 1);
  return Math.round(exact / magnitude) * magnitude;
}

export function photoCountLabel(bytes: number): string {
  return formatCount(approxPhotos(bytes));
}

export function computeExpiry(from: string | Date, tier: Tier): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + tier.retentionDays);
  return d;
}

export const MAX_ARCHIVE_BUILDS = 3;

export const RETENTION_WARNING_DAYS = [14, 7, 1];

export const HARD_DELETE_GRACE_DAYS = 14;
