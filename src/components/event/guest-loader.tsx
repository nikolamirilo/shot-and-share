import { Hole, cx } from "@/components/ui";

/**
 * What a guest sees between tapping the link and the page arriving.
 *
 * The page cannot draw anything until the database has answered: the token has
 * to be resolved, the event read, the tier looked up and the cover photograph
 * signed. On a venue's wifi that is a second or two in which the tap did
 * nothing at all - which reads as a dead QR code, at the one moment the
 * product has to look like it works.
 *
 * It is deliberately not a skeleton of the real page. Four covers are possible
 * and we do not yet know which one this event picked, so a guessed outline
 * would be wrong three times out of four and the correction would read as a
 * jump. A frame with film running through it is honestly "your photos are
 * coming", at any cover.
 *
 * Linen rather than the well, even though a full-screen cover arrives dark: a
 * light screen going dark once is a photograph landing, where a dark screen
 * going light is a flash of the wrong page.
 */

/** Six rows, so the strip can loop on half its own height. See `.reel`. */
const ROWS = [0, 1, 2, 3, 4, 5];

/** Which way each bracket is pulled while the lens hunts for focus. */
const CORNERS = [
  {
    key: "tl",
    place: "left-0 top-0 rounded-tl-[3px] border-l-2 border-t-2",
    x: "-3px",
    y: "-3px",
  },
  {
    key: "tr",
    place: "right-0 top-0 rounded-tr-[3px] border-r-2 border-t-2",
    x: "3px",
    y: "-3px",
  },
  {
    key: "br",
    place: "bottom-0 right-0 rounded-br-[3px] border-b-2 border-r-2",
    x: "3px",
    y: "3px",
  },
  {
    key: "bl",
    place: "bottom-0 left-0 rounded-bl-[3px] border-b-2 border-l-2",
    x: "-3px",
    y: "3px",
  },
] as const;

export function GuestLoader() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-7 bg-linen px-6"
      role="status"
      aria-busy="true"
      aria-label="Opening the event"
    >
      {/* The mark's frame, with a photograph moving through it. The wordmark
          is deliberately not here: this screen renders before we know whether
          the event is a paid one, and a paid event page carries nothing of
          ours. Everything inside is sized off this box. */}
      <div className="relative h-40 w-40">
        {CORNERS.map((corner) => (
          <span
            key={corner.key}
            aria-hidden="true"
            className={cx(
              "focus-corner absolute h-6 w-6 border-ink",
              corner.place,
            )}
            style={
              { "--fx": corner.x, "--fy": corner.y } as React.CSSProperties
            }
          />
        ))}

        {/* The well the film runs through, inset so the brackets frame it
            rather than sit on it. */}
        <div className="absolute inset-[0.875rem] overflow-hidden rounded-[0.625rem] bg-well shadow-lg">
          <div className="reel absolute inset-x-0 top-0" aria-hidden="true">
            {ROWS.map((row) => (
              /* Sprocket, frame, sprocket - one row of film, at a negative's
                 own proportions. The margin is part of the row's height, which
                 is what makes the loop land exactly: six rows of 4rem is half
                 of 24rem. */
              <div
                key={row}
                className="mb-2 flex h-14 items-center gap-2 px-2"
              >
                <span className="h-2 w-2 shrink-0 rounded-[2px] bg-linen/30" />
                <span className="h-full flex-1 rounded-[4px] bg-blush/85" />
                <span className="h-2 w-2 shrink-0 rounded-[2px] bg-linen/30" />
              </div>
            ))}
          </div>

          {/* The light going over it. Its own element rather than a filter on
              the reel, so it crosses the frame at its own pace. */}
          <span
            aria-hidden="true"
            className="reel-sweep pointer-events-none absolute inset-x-0 h-1/2 bg-linear-to-b from-transparent via-linen/20 to-transparent"
          />
        </div>
      </div>

      <div className="text-center">
        {/* The three holes, the way every other waiting state in the product
            marks itself. */}
        <div className="mx-auto flex w-fit items-end gap-2" aria-hidden="true">
          <Hole size={8} />
          <Hole size={14} />
          <Hole size={6} />
        </div>
        <p className="eyebrow mt-4 text-mist">getting the photos ready</p>
      </div>
    </div>
  );
}
