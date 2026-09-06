import Link from "next/link";
import type { ComponentProps } from "react";

import { ON_SCRIM } from "@/components/ui/scrim";
import { cx } from "@/lib/cx";

/**
 * Buttons sit above the page on a soft shadow and lift on hover. Every variant
 * is a filled shape, which is what carries a button when nothing is outlined.
 */
type Variant = "primary" | "secondary" | "ghost" | "onDark";
type Size = "xs" | "sm" | "md" | "lg";

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

/**
 * The colours alone, with nothing that moves. A static copy of a button - the
 * host's preview draws one rather than putting a second real button in their
 * tab order - takes its fill from here, so a button and its picture cannot
 * drift apart, and both follow the theme.
 */
export const BUTTON_FILL: Record<Variant, string> = {
  primary: "bg-claret text-chalk",
  secondary: "bg-paper text-ink",
  /* On ink or on a photograph a shadow has nothing to fall on, so this one is
     carried by the fill alone - and on those grounds the light shape is the
     one that reads, not the wine one. The scrim's own pair rather than the
     theme's, for the reason set out in ui/scrim. */
  onDark: ON_SCRIM,
  ghost: "text-ink underline decoration-2 underline-offset-4 decoration-claret",
};

const VARIANTS: Record<Variant, string> = {
  primary: `${BUTTON_FILL.primary} ${LIFT}`,
  secondary: `${BUTTON_FILL.secondary} ${LIFT}`,
  onDark: `${BUTTON_FILL.onDark} hover:-translate-y-0.5`,
  ghost: `${BUTTON_FILL.ghost} hover:decoration-ink`,
};

const SIZES: Record<Size, string> = {
  /* Below the 44px rule on purpose, and the only size that is: it exists for
     a chip sitting inside another object - the platform bar's button next to
     the wordmark - where a 40px pill inside a 44px bar is the bar. Anything a
     thumb has to find on its own uses `sm` or larger. */
  xs: "min-h-9 px-2.5 py-1.5 text-[0.875rem]",
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


/**
 * A button that is really a `<label>`, so a tap lands on the file input it
 * names rather than on script that opens one.
 *
 * This exists for one reason: on some iOS builds a file picker opened by
 * `input.click()` comes up without multi-select, while the same input opened by
 * tapping a label attached to it comes up with it. A label is also the only
 * form of "open the picker" that needs no JavaScript at all, which makes it the
 * most reliable thing on the guest page.
 *
 * `disabled` is not an attribute a label has, so it is drawn instead: dimmed
 * and taken out of the way of taps.
 */
export function ButtonLabel({
  variant = "primary",
  size = "md",
  className,
  disabled,
  ...props
}: ComponentProps<"label"> & {
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
}) {
  return (
    <label
      className={cx(
        BASE,
        VARIANTS[variant],
        variant === "ghost" ? "min-h-10 px-1 py-2" : SIZES[size],
        "cursor-pointer",
        disabled && "pointer-events-none opacity-45",
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
