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

/** The mark, drawn at the size the card needs it. */
function Mark({ size }: { size: number }) {
  const bracket = "M 26 76 L 26 34 Q 26 26 34 26 L 76 26";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <g stroke={CHALK} strokeWidth={18} strokeLinecap="square" fill="none">
        <path d={bracket} />
        <path d={bracket} transform="rotate(90 100 100)" />
        <path d={bracket} transform="rotate(180 100 100)" />
        <path d={bracket} transform="rotate(270 100 100)" />
      </g>
      <circle cx={100} cy={100} r={20} fill={CHALK} />
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
