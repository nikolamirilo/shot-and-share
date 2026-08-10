import type { ReactNode } from "react";

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
        className="block font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[0.9375rem] text-ash">{hint}</p>}
      {error && (
        <p className="text-[0.9375rem] font-semibold text-ash">{error}</p>
      )}
    </div>
  );
}

/**
 * `text-body` is 17px, and that is not a typographic preference: Safari zooms
 * the whole page in when a focused field is under 16px, and a guest who has to
 * pinch back out to reach the upload button is a guest who does not upload.
 * Every field in the product goes through this class or matches it.
 *
 * Butter rather than Cream, and sunken rather than raised. Most fields stand in
 * a Cream card, so the field steps *down* to the page colour and takes an inner
 * shadow along its top edge: a place something goes into. Everything the host
 * can press in the same card is doing the opposite.
 */
export const inputClass =
  "w-full min-h-11 rounded-xl bg-linen inset-shadow-well px-3.5 py-2.5 text-body placeholder:text-mist/60 focus:outline-none focus-visible:outline-3 focus-visible:outline-ink";
