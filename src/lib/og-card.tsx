import { MARK } from "@/components/layout/logo";
import { SITE } from "@/lib/seo";

/**
 * The picture that represents this site in a feed, a message and a search
 * result preview.
 *
 * It is drawn rather than screenshotted, for two reasons. A screenshot of the
 * hero would be a photograph of an interface - unreadable at the 200px wide
 * this is usually seen at - and the real hero's type is Archivo, which the
 * image renderer would have to fetch from Google at request time. The whole
 * font strategy in this product is that a build never depends on reaching an
 * external host, and an OG image that 500s when Google Fonts is slow is worse
 * than a plain one.
 *
 * So: the claret ground, the crop mark, one sentence set as large as it goes,
 * and the address. It survives being 200px wide in a group chat, which is the
 * only test that matters.
 */
export const OG_SIZE = { width: 1200, height: 630 };

const CLARET = "#7A1230";
const CHALK = "#FDF6F7";

/**
 * The mark, drawn at the size the card needs it, all in chalk on the claret.
 *
 * Written out as plain shapes on purpose. Satori resolves no components inside
 * an `<svg>`, so the coordinates are imported and the elements are not.
 */
function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <g
        stroke={CHALK}
        strokeWidth={MARK.frameWidth}
        strokeLinecap="square"
        fill="none"
      >
        <path d={MARK.bracket} />
        {MARK.corners.map((deg) => (
          <path key={deg} d={MARK.bracket} transform={`rotate(${deg} 100 100)`} />
        ))}
      </g>
      <g
        stroke={CHALK}
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
        fill={CHALK}
        transform={MARK.print.tilt}
      />
    </svg>
  );
}

export function OgCard({
  headline,
  kicker,
  footnote,
}: {
  headline: string;
  kicker: string;
  footnote: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: CLARET,
        color: CHALK,
        padding: "68px 72px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <Mark size={54} />
        <span
          style={{
            marginLeft: 18,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          {SITE.name}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontSize: 24,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: 0.72,
          }}
        >
          {kicker}
        </span>
        <span
          style={{
            marginTop: 22,
            fontSize: 82,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            /* Two lines at most. A third would push the address off the card
               on a 1200x630 canvas, and satori does not reflow to fit. */
            maxWidth: 960,
          }}
        >
          {headline}
        </span>
      </div>

      <span style={{ fontSize: 26, opacity: 0.72 }}>{footnote}</span>
    </div>
  );
}
