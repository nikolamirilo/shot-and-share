import Link from "next/link";
import type { ComponentProps } from "react";

import { cx } from "@/lib/cx";

/**
 * Buttons sit above the page on a soft shadow and lift on hover. Every variant
 * is a filled shape, which is what carries a button when nothing is outlined.
 */
type Variant = "primary" | "secondary" | "ghost" | "onDark";
type Size = "sm" | "md" | "lg";

/**
 * `leading-tight` is load-bearing: body copy runs at 1.65 and a button inherits
 * it, which puts a 17px label in a 56px box. Buttons set their own leading and
 * reach height through padding and a minimum.
 *
 * `min-h` is the tap target. Anything a thumb has to hit is at least 44px.
 */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-2xl text-center font-semibold leading-tight touch-manipulation transition-transform transition-shadow duration-150 disabled:opacity-45 disabled:pointer-events-none";

const LIFT =
  "shadow-md hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm";

const VARIANTS: Record<Variant, string> = {
  primary: `bg-claret text-chalk ${LIFT}`,
  secondary: `bg-paper text-ink ${LIFT}`,
  /* On ink or on a photograph a shadow has nothing to fall on, so this one is
     carried by the fill alone - and on those grounds the light shape is the
     one that reads, not the wine one. */
  onDark: "bg-chalk text-ink hover:-translate-y-0.5",
  ghost:
    "text-ink underline decoration-2 underline-offset-4 decoration-claret hover:decoration-ink",
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
