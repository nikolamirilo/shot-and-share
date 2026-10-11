export type Variant = "primary" | "reversed" | "mono";

const PALETTES: Record<Variant, { bracket: string; dot: string }> = {
  primary: { bracket: "#181214", dot: "#7A1230" },
  reversed: { bracket: "#FDF6F7", dot: "#C25A72" },
  mono: { bracket: "currentColor", dot: "currentColor" },
};

export const MARK = {
  bracket: "M 26 76 L 26 34 Q 26 26 34 26 L 76 26",
  corners: [90, 180, 270],
  frameWidth: 18,
  trail: ["M58 82 L82 82", "M46 101 L82 101", "M58 120 L82 120"],
  trailWidth: 11,
  print: { x: 94, y: 78, size: 46, rx: 10, tilt: "rotate(-12 117 101)" },
} as const;

export function LogoMark({
  variant = "primary",
  className,
  title = "Shot & Share",
}: {
  variant?: Variant;
  className?: string;
  title?: string;
}) {
  const c = PALETTES[variant];

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        stroke={c.bracket}
        strokeWidth={MARK.frameWidth}
        strokeLinecap="square"
        fill="none"
      >
        <path d={MARK.bracket} />
        {MARK.corners.map((deg) => (
          <path
            key={deg}
            d={MARK.bracket}
            transform={`rotate(${deg} 100 100)`}
          />
        ))}
      </g>

      <g
        stroke={c.dot}
        strokeWidth={MARK.trailWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {MARK.trail.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <rect
        x={MARK.print.x}
        y={MARK.print.y}
        width={MARK.print.size}
        height={MARK.print.size}
        rx={MARK.print.rx}
        fill={c.dot}
        transform={MARK.print.tilt}
      />
    </svg>
  );
}

function Amp({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-sans font-bold text-claret ${className}`}
      style={{ fontStretch: "normal", letterSpacing: "-0.01em" }}
    >
      &amp;
    </span>
  );
}

export function Wordmark({
  variant = "primary",
  className = "",
  markClassName = "h-6 w-auto sm:h-7",
  labelClassName = "",
}: {
  variant?: Variant;
  className?: string;
  markClassName?: string;
  labelClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 sm:gap-2.5 ${className}`}>
      <LogoMark variant={variant} className={markClassName} />
      <span
        className={`font-display text-[1.0625rem] font-extrabold uppercase tracking-[-0.052em] sm:text-[1.1875rem] ${labelClassName}`}
        style={{ fontStretch: "74%" }}
      >
        Shot <Amp className="mx-[0.06em]" /> Share
      </span>
    </span>
  );
}
