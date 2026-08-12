/**
 * The mark: a photo leaving the frame.
 *
 * Four corner brackets - the gesture every photograph starts with, deciding
 * what is inside the picture and what is not - and inside them a print already
 * on its way out, tilted, with its trail behind it. The frame says a photo was
 * taken. The print says it did not stay where it was taken, which is the whole
 * product.
 *
 * The trail does the work, which is why the photo itself is a plain rounded
 * square. Drawing a picture inside the picture is how a mark turns into an
 * illustration, and an illustration cannot be printed on a card in a dark room.
 *
 * The print and its trail are the one flash of claret and appear in no other
 * mark. Below roughly 20px the three lines close up against the print and the
 * middle reads as a single claret shape moving right - nothing here depends on
 * the lines being counted.
 */

export type Variant = "primary" | "reversed" | "mono";

const PALETTES: Record<Variant, { bracket: string; dot: string }> = {
  primary: { bracket: "#181214", dot: "#7A1230" },
  reversed: { bracket: "#FDF6F7", dot: "#C25A72" },
  mono: { bracket: "currentColor", dot: "currentColor" },
};

/**
 * The mark, as coordinates rather than as a component.
 *
 * The favicon, the home-screen icon and the card that represents this site in
 * a feed are drawn somewhere else, and two of them go through Satori, which
 * walks an `<svg>` looking for plain shapes and silently drops anything it has
 * to resolve first - a component nested in there renders as nothing at all,
 * and nothing at all is exactly what a missing icon looks like. So what is
 * shared is these numbers, and each renderer writes its own plain elements
 * from them. Everything is on a 0 0 200 200 canvas.
 *
 * The bracket is drawn once and rotated into the other three corners. Its arms
 * are deliberately short: a longer arm closes the frame and the mark turns
 * into a square with a hole in it.
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
 * The ampersand, borrowed from the body face.
 *
 * Archivo draws its ampersand as an open, reversed-3 form. It is a fine glyph
 * and it is wrong here: at the wordmark's weight and 82% width it stops looking
 * like an ampersand at all and starts looking like a mistake in the logo. So
 * the two words are set in the display face and the one character between them
 * is set in the body face at a conventional weight, in claret.
 *
 * This is a lockup, not a typographic accident, and it is the same everywhere
 * the name appears - which is why it lives here rather than in each caller.
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
 * The mark plus the name.
 *
 * On a narrow phone the name is the first thing to go. A header is a row of
 * competing claims on about 300 usable pixels, and losing four hundredths of
 * the brand costs less than pushing "New event" into wrapping onto two lines -
 * the mark on its own is still unmistakably this product. Pass
 * `labelClassName="hidden xs:inline"` anywhere that row is tight.
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
