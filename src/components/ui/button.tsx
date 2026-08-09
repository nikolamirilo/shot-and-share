import Link from "next/link";
import type { ComponentProps } from "react";

import { cx } from "@/lib/cx";

/**
 * Buttons sit above the page on a soft shadow and lift further on hover, which
 * keeps the physical feel of the slab without outlining anything.
 *
 * Every variant is a filled shape. That is what carries a button now that there
 * is no stroke around it: Secondary is Cream on a Butter page and reads as a
 * button because it is lighter than what it sits on and casts a shadow, not
 * because it is drawn.
 */
type Variant = "primary" | "secondary" | "ghost" | "onDark";
type Size = "sm" | "md" | "lg";

/**
 * `leading-tight` is load-bearing rather than cosmetic. Body copy runs at 1.65
 * and a button inherits it, which puts 11px of empty line box above and below a
 * single word - a 17px label in a 56px box. On a phone, where labels are long
 * relative to the width, that reads as a button of roughly double the height it
 * should be. Buttons set their own leading and reach their height through
 * padding and a minimum, so a two-word label and a six-word one look related.
 *
 * `min-h` is the tap target. Anything a thumb has to hit is at least 44px.
 */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl text-center font-semibold leading-tight touch-manipulation transition-transform transition-shadow duration-150 disabled:opacity-45 disabled:pointer-events-none";

const LIFT =
  "shadow-md hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm";

const VARIANTS: Record<Variant, string> = {
  primary: `bg-pepper text-butter ${LIFT}`,
  secondary: `bg-cream text-pepper ${LIFT}`,
  /* On a Pepper or a photographic background a shadow has nothing to fall on,
     so this one is carried by the Gouda fill alone. */
  onDark: "bg-gouda text-pepper hover:-translate-y-0.5",
  ghost:
    "text-pepper underline decoration-2 underline-offset-4 decoration-rind hover:decoration-pepper",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-10 px-3.5 py-2 text-[0.9375rem]",
  md: "min-h-11 px-4.5 py-2.5 text-[1.0625rem] sm:px-5",
  lg: "min-h-12 px-5 py-3 text-[1.0625rem] sm:px-7 sm:py-3.5",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cx(
        BASE,
        VARIANTS[variant],
        variant === "ghost" ? "min-h-10 px-1 py-2" : SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link
      className={cx(
        BASE,
        VARIANTS[variant],
        variant === "ghost" ? "min-h-10 px-1 py-2" : SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
