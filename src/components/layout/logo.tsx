/**
 * The mark: a photo leaving the frame. Four corner brackets, and inside them a
 * tilted print on its way out with its trail behind it.
 *
 * Nothing depends on the three trail lines being counted - below about 20px
 * they close up into a single claret shape moving right.
 */

export type Variant = "primary" | "reversed" | "mono";

const PALETTES: Record<Variant, { bracket: string; dot: string }> = {
  primary: { bracket: "#181214", dot: "#7A1230" },
  reversed: { bracket: "#FDF6F7", dot: "#C25A72" },
  mono: { bracket: "currentColor", dot: "currentColor" },
};

/**
 * The mark as coordinates rather than a component, on a 0 0 200 200 canvas.
 *
 * The favicon and the feed card go through Satori, which walks an `<svg>` for
 * plain shapes and silently drops anything it has to resolve first - a nested
 * component renders as nothing at all. So the numbers are shared and each
 * renderer writes its own plain elements.
 *
 * The bracket is drawn once and rotated into the other three corners. Its arms
 * are short on purpose: longer and the frame closes into a square with a hole.
 */
export const MARK = {
  bracket: "M 26 76 L 26 34 Q 26 26 34 26 L 76 26",
  corners: [90, 180, 270],
  frameWidth: 18,
  /** The trail, drawn before the print so the print reads as ahead of it. */
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

/**
 * The ampersand, borrowed from the body face. Archivo's is an open reversed-3
 * form, which at the wordmark's weight and 82% width reads as a mistake in the
 * logo rather than as an ampersand.
 */
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

/**
 * The mark plus the name. On a narrow phone the name is the first thing to go -
 * pass `labelClassName="hidden xs:inline"` anywhere the row is tight.
 */
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
