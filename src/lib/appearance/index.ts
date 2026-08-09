/**
 * The look of a guest's event page, in five parts.
 *
 * This barrel keeps `@/lib/appearance` meaning what it always meant, so no
 * caller had to change. Reach past it when you want only one part: the upload
 * and cover variants are pure data, and a client component that imports them
 * through here drags the theme table and the billing tiers along with it.
 */
export * from "@/lib/appearance/themes";
export * from "@/lib/appearance/custom-palette";
export * from "@/lib/appearance/variants";
export * from "@/lib/appearance/css-vars";
export * from "@/lib/appearance/resolve";
