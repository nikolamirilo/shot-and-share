/**
 * The mark: a crop frame.
 *
 * Four corner brackets and nothing in the middle. It is the gesture every
 * photograph starts with - deciding what is inside the picture and what is not
 * - and it is the only mark in the product that is drawn rather than
 * photographed, which is why it stays this simple.
 *
 * The gap in the middle is load-bearing. At 16px the brackets read as one
 * square, at 200px they read as four marks around an empty frame, and both are
 * the same object. A mark that has to survive being printed on a card in a dark
 * room cannot be an illustration.
 *
 * The shutter dot is the one flash of claret and appears in no other mark.
 */

type Variant = "primary" | "reversed" | "mono";

const PALETTES: Record<Variant, { bracket: string; dot: string }> = {
  primary: { bracket: "#181214", dot: "#7A1230" },
  reversed: { bracket: "#FDF6F7", dot: "#C25A72" },
  mono: { bracket: "currentColor", dot: "currentColor" },
};

/* One bracket, drawn once and rotated into the other three corners. The arms
   are deliberately short: a longer arm closes the frame and the mark turns
   into a square with a hole in it. */
const BRACKET = "M 26 76 L 26 34 Q 26 26 34 26 L 76 26";

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
        strokeWidth={18}
        strokeLinecap="square"
        fill="none"
      >
        <path d={BRACKET} />
        <path d={BRACKET} transform="rotate(90 100 100)" />
        <path d={BRACKET} transform="rotate(180 100 100)" />
        <path d={BRACKET} transform="rotate(270 100 100)" />
      </g>

      {/* The subject. One dot, centred, the size of a shutter release. */}
      <circle cx={100} cy={100} r={20} fill={c.dot} />
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
