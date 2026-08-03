/**
 * The mark: a camera taking a picture of cheese.
 *
 * The cheese is the subject and the camera is looking at it. It is a slice, not
 * a wedge — the cheese with holes is Emmental and Emmental is cut in slices.
 * The hole is the whole brand, so putting a generic wedge in the frame would
 * throw away the one idea the system is built on.
 *
 * Three details say "this photo is being taken right now": focus brackets in
 * the corners of the frame, a flash burst off the top left, and the Ember
 * shutter light — the only place that colour ever appears.
 */

type Variant = "primary" | "reversed" | "mono";

const PALETTES: Record<Variant, Record<string, string>> = {
  primary: {
    body: "#1F1607",
    trim: "#B0670F",
    frame: "#FFFDF4",
    cheese: "#FFC02E",
    cheeseEdge: "#B0670F",
    hole: "#4A3110",
    shutter: "#E2542F",
    line: "#1F1607",
  },
  reversed: {
    body: "#FFFDF4",
    trim: "#FFC02E",
    frame: "#1F1607",
    cheese: "#FFC02E",
    cheeseEdge: "#B0670F",
    hole: "#1F1607",
    shutter: "#E2542F",
    line: "#FFFDF4",
  },
  mono: {
    body: "currentColor",
    trim: "currentColor",
    frame: "none",
    cheese: "none",
    cheeseEdge: "none",
    hole: "currentColor",
    shutter: "none",
    line: "currentColor",
  },
};

/** The slice, drawn twice: a Rind face below for thickness, Gouda on top. */
const SLICE = "M -31 -15 L 27 -22 L 33 13 L -25 21 Z";

const HOLES: Array<[number, number, number]> = [
  [-15, -3, 7],
  [7, 3, 5],
  [19, -9, 3.4],
  [-3, -13, 3],
  [9, 13, 4.2],
];

export function LogoMark({
  variant = "primary",
  className,
  title = "Say Cheese",
}: {
  variant?: Variant;
  className?: string;
  title?: string;
}) {
  const c = PALETTES[variant];
  const mono = variant === "mono";

  return (
    <svg
      viewBox="0 0 240 200"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Flash burst — three short strokes radiating off the top left */}
      <g
        stroke={c.line}
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
        opacity={mono ? 1 : 0.95}
      >
        <path d="M 34 40 L 24 30" />
        <path d="M 50 30 L 46 17" />
        <path d="M 22 54 L 8 50" />
      </g>

      {/* Viewfinder bump and flash unit */}
      <rect x={52} y={28} width={54} height={22} rx={7} fill={c.trim} />
      <rect x={156} y={30} width={40} height={20} rx={6} fill={c.trim} />

      {/* Body */}
      <rect
        x={18}
        y={46}
        width={204}
        height={136}
        rx={22}
        fill={c.body}
        stroke={mono ? c.line : "none"}
        strokeWidth={mono ? 4 : 0}
      />

      {/* Shutter light — the one flash of Ember */}
      {!mono && <circle cx={200} cy={66} r={6.5} fill={c.shutter} />}

      {/* Lens: a deep barrel, not a flat ring */}
      <circle cx={120} cy={114} r={58} fill={c.trim} />
      <circle cx={120} cy={114} r={50} fill={c.body} />
      {mono && (
        <>
          <circle
            cx={120}
            cy={114}
            r={58}
            fill="none"
            stroke={c.line}
            strokeWidth={4}
          />
          <circle
            cx={120}
            cy={114}
            r={38}
            fill="none"
            stroke={c.line}
            strokeWidth={4}
          />
        </>
      )}

      {/* The frame — what the camera actually sees */}
      <circle cx={120} cy={114} r={38} fill={c.frame} />

      <g clipPath="url(#sc-frame-clip)">
        <clipPath id="sc-frame-clip">
          <circle cx={120} cy={114} r={38} />
        </clipPath>

        <g transform="translate(120 114) rotate(-7)">
          {/* Thickness: the Rind face sitting below and behind */}
          <path
            d={SLICE}
            transform="translate(0 8)"
            fill={mono ? "none" : c.cheeseEdge}
            stroke={c.line}
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <path
            d={SLICE}
            fill={mono ? "none" : c.cheese}
            stroke={c.line}
            strokeWidth={4}
            strokeLinejoin="round"
          />
          {HOLES.map(([cx, cy, r], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill={mono ? "none" : c.hole}
              stroke={c.line}
              strokeWidth={mono ? 3 : 0}
            />
          ))}
        </g>
      </g>

      {/* Focus brackets — the marks a viewfinder puts around its subject */}
      <g
        stroke={mono ? c.line : c.cheeseEdge}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
      >
        <path d="M 96 98 L 96 90 L 104 90" />
        <path d="M 144 98 L 144 90 L 136 90" />
        <path d="M 96 130 L 96 138 L 104 138" />
        <path d="M 144 130 L 144 138 L 136 138" />
      </g>
    </svg>
  );
}

export function Wordmark({
  variant = "primary",
  className = "",
  markClassName = "h-9 w-auto",
}: {
  variant?: Variant;
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark variant={variant} className={markClassName} />
      <span
        className="font-display text-[1.35rem] font-extrabold tracking-[-0.04em]"
        style={{ fontStretch: "86%" }}
      >
        Say Cheese
      </span>
    </span>
  );
}
