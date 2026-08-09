/**
 * A number the host is meant to read at a glance, with its label above it.
 *
 * The display face is set at a narrow width on purpose: these sit two to a row
 * on a phone, and a five-digit count in the full-width face wraps its own
 * column. `fontStretch` rather than a smaller size, so a big number and a small
 * one still look like the same kind of thing.
 */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
        {label}
      </dt>
      <dd
        className="mt-1 font-display text-[1.75rem] font-extrabold leading-none tracking-[-0.04em] tabular-nums sm:text-[1.9375rem]"
        style={{ fontStretch: "86%" }}
      >
        {value}
      </dd>
      {hint && <p className="mt-1 text-[0.8125rem] text-crust">{hint}</p>}
    </div>
  );
}
