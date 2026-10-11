import { MARK } from "@/components/layout/Logo";
import type { Palette } from "@/lib/appearance/themes";
import { SITE } from "@/lib/seo";

export const OG_SIZE = { width: 1200, height: 630 };

const CLARET = "#7A1230";
const CHALK = "#FDF6F7";

/** Written out as plain shapes: Satori resolves no components inside an `<svg>`. */
function Mark({ size, colour = CHALK }: { size: number; colour?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <g
        stroke={colour}
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
        stroke={colour}
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
        fill={colour}
        transform={MARK.print.tilt}
      />
    </svg>
  );
}

function Lockup({ colour = CHALK }: { colour?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <Mark size={54} colour={colour} />
      <span
        style={{
          marginLeft: 18,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          color: colour,
        }}
      >
        {SITE.name}
      </span>
    </div>
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
      <Lockup />

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
            /*
             * Two lines at most. Satori does not reflow to fit, and a third would push
             * the address off a 1200x630 canvas.
             */
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

const CARD_WASH =
  "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.46) 34%, rgba(0,0,0,0.10) 68%, rgba(0,0,0,0.16) 100%)";

/**
 * Satori does not reflow to fit, so the name is sized here rather than by the layout.
 */
function fitName(name: string): { text: string; fontSize: number } {
  const text = name.length > 64 ? `${name.slice(0, 63).trimEnd()}…` : name;
  const fontSize = text.length > 44 ? 54 : text.length > 26 ? 68 : 84;
  return { text, fontSize };
}

export interface EventCardProps {
  name: string;
  photo?: string | null;
  palette: Palette;
  invitation: string;
  branding: boolean;
}

export function EventOgCard({
  name,
  photo,
  palette,
  invitation,
  branding,
}: EventCardProps) {
  const { text, fontSize } = fitName(name);
  const ink = photo ? CHALK : palette.onAccent;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: photo ? palette.accentDeep : palette.accent,
      }}
    >
      {photo && (
        /*
         * Drawn by satori rather than a browser, so it is a plain img and the alt lands
         * nowhere.
         */
        <img
          alt=""
          src={photo}
          width={OG_SIZE.width}
          height={OG_SIZE.height}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: OG_SIZE.width,
            height: OG_SIZE.height,
            objectFit: "cover",
          }}
        />
      )}

      {photo && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: OG_SIZE.width,
            height: OG_SIZE.height,
            backgroundImage: CARD_WASH,
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "68px 72px",
          color: ink,
        }}
      >
        <div style={{ display: "flex" }}>
          {branding && <Lockup colour={ink} />}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 960,
            }}
          >
            {text}
          </span>
          <span style={{ marginTop: 26, fontSize: 30, opacity: 0.86 }}>
            {invitation}
          </span>
        </div>
      </div>
    </div>
  );
}
