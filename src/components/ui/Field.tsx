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

export const inputClass =
  "w-full min-h-11 rounded-xl bg-linen inset-shadow-well px-3.5 py-2.5 text-body placeholder:text-mist/60 focus:outline-none focus-visible:outline-3 focus-visible:outline-ink";
