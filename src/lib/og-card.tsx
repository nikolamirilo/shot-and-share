import { MARK } from "@/components/layout/logo";
import type { Palette } from "@/lib/appearance/themes";
import { SITE } from "@/lib/seo";

/**
 * The picture that represents this site in a feed, drawn rather than
 * screenshotted: an interface photographed at the 200px this is usually seen at
 * is unreadable, and the hero's Archivo would have to be fetched from Google at
 * request time - an OG image that 500s when Google Fonts is slow is worse than
 * a plain one.
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

/**
 * The mark and the name, drawn together the way the header draws them. Both
 * cards want it and an event's wants it in its own colour, so the colour is
 * passed rather than assumed.
 */
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

/* -------------------------------------------------------------------------- */
/*  The event's own card                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The wash under the type, so a name reads over a photograph nobody has seen.
 * The cover's own, and for the same reason: white type on a bright sky is not
 * type. Weaker at the top than the page's, because a card is a third of the
 * height and the same stops read as a darkened photograph.
 */
const CARD_WASH =
  "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.46) 34%, rgba(0,0,0,0.10) 68%, rgba(0,0,0,0.16) 100%)";

/**
 * Satori does not reflow to fit, so the name is sized here rather than by the
 * layout. Long ones step down and very long ones are cut: a name that runs off
 * the canvas takes the date and the invitation with it.
 */
function fitName(name: string): { text: string; fontSize: number } {
  const text = name.length > 64 ? `${name.slice(0, 63).trimEnd()}…` : name;
  const fontSize = text.length > 44 ? 54 : text.length > 26 ? 68 : 84;
  return { text, fontSize };
}

export interface EventCardProps {
  name: string;
  /** Already formatted for reading. Absent on a card for a dead link. */
  date?: string | null;
  /** The cover, as a data URL. Null renders the typographic card instead. */
  photo?: string | null;
  palette: Palette;
  /** What the card asks for. The page's job, in the page's words. */
  invitation: string;
  /** Free events carry the mark, exactly as the page does. */
  branding: boolean;
}

/**
 * What an event's share link turns into in a group chat.
 *
 * A guest is sent this link by a person, not by us, and the card has to answer
 * "is this the right party?" before anybody taps it. So it is the event's
 * cover, the event's name and the event's colours - the page they are about to
 * land on, at thumbnail size - rather than the product's card, which answered
 * a question nobody in that chat was asking.
 *
 * The mark follows the page: a paid event has no header and no footer of ours,
 * so its card carries none either.
 */
export function EventOgCard({
  name,
  date,
  photo,
  palette,
  invitation,
  branding,
}: EventCardProps) {
  const { text, fontSize } = fitName(name);
  // On a photograph the type is always chalk over the wash. Without one it is
  // the pairing the host's theme already guarantees is legible.
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
        /* Drawn by satori rather than a browser, so it is a plain img: the
           alt is there for the linter and lands nowhere. */
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
        {/* The slot stays even when there is no mark in it. Dropped, the type
            below becomes the only child of a space-between column and rides
            to the top of the card. */}
        <div style={{ display: "flex" }}>
          {branding && <Lockup colour={ink} />}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {date && (
            <span
              style={{
                fontSize: 24,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                opacity: 0.82,
              }}
            >
              {date}
            </span>
          )}
          <span
            style={{
              marginTop: 22,
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
