import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Buttons carry a hard offset shadow and lift on hover, which matches the
 * physical, cut-out feel of the slab without introducing a second visual idea.
 *
 * The primary button's shadow is Rind rather than Pepper: a Pepper shadow under
 * a Pepper button is invisible. Everything lighter keeps the Pepper shadow the
 * brand specifies.
 */
type Variant = "primary" | "secondary" | "ghost" | "onDark";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-transform transition-shadow duration-150 disabled:opacity-45 disabled:pointer-events-none";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-pepper text-butter shadow-[4px_4px_0_var(--color-rind)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--color-rind)] active:translate-y-0 active:shadow-[2px_2px_0_var(--color-rind)]",
  secondary:
    "bg-cream text-pepper border-2 border-pepper shadow-[4px_4px_0_var(--color-pepper)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--color-pepper)] active:translate-y-0 active:shadow-[2px_2px_0_var(--color-pepper)]",
  onDark:
    "bg-gouda text-pepper border-2 border-pepper shadow-[4px_4px_0_var(--color-crust)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--color-crust)]",
  ghost:
    "text-pepper underline decoration-2 underline-offset-4 decoration-rind hover:decoration-pepper",
};

const SIZES: Record<Size, string> = {
  sm: "px-3.5 py-2 text-[0.9375rem]",
  md: "px-5 py-2.5 text-[1.0625rem]",
  lg: "px-7 py-3.5 text-[1.0625rem]",
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
        variant === "ghost" ? "px-1 py-1" : SIZES[size],
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
        variant === "ghost" ? "px-1 py-1" : SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cx("eyebrow", className)}>{children}</p>;
}

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article" | "section";
}) {
  return <Tag className={cx("card p-6", className)}>{children}</Tag>;
}

/**
 * A punched hole. Where a circle appears in the interface it is this object at
 * a different size — list bullets, step markers, loading states, avatars.
 */
export function Hole({
  size = 16,
  className,
  children,
}: {
  size?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={cx("hole inline-block shrink-0 align-middle", className)}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

export function Badge({
  children,
  tone = "dark",
}: {
  children: ReactNode;
  tone?: "dark" | "gouda" | "outline";
}) {
  const tones = {
    dark: "bg-pepper text-butter",
    gouda: "bg-gouda text-pepper border-2 border-pepper",
    outline: "border-2 border-pepper text-pepper",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.16em]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[0.9375rem] text-crust">{hint}</p>}
      {error && (
        <p className="text-[0.9375rem] font-semibold text-crust">{error}</p>
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border-2 border-pepper bg-cream px-3.5 py-2.5 text-body placeholder:text-rind/60 focus:outline-none focus-visible:outline-3 focus-visible:outline-pepper";

export function ProgressBar({
  percent,
  tone = "dark",
}: {
  percent: number;
  tone?: "dark" | "warn";
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full border-2 border-pepper bg-butter"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Ember is the shutter light and nothing else, so a full bar signals
          with Rind and lets the copy next to it carry the urgency. */}
      <div
        className={cx(
          "h-full transition-[width] duration-300",
          tone === "warn" ? "bg-rind" : "bg-pepper",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
