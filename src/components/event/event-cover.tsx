import type { Palette } from "@/lib/appearance/themes";
import {
  type CoverPosition,
  type CoverVariant,
  DEFAULT_POSITION,
} from "@/lib/appearance/variants";
import { paletteToCssVars } from "@/lib/appearance";
import type { FontSet } from "@/lib/fonts";
import { fontToCssVars } from "@/lib/fonts";
import { formatEventDate } from "@/lib/format";
import { Hole, PhotoPlaceholder, cx } from "@/components/ui";

/**
 * Re-skins everything inside it, by setting the same CSS custom properties the
 * design system already defines. No component takes a `theme` or `font` prop.
 *
 * `font-sans` on the root is load-bearing: body copy inherits its family from
 * <body>, and an inherited declaration is not re-evaluated against a variable
 * this element redefines.
 */
export function EventThemeRoot({
  palette,
  font,
  className,
  children,
}: {
  palette: Palette;
  font?: FontSet;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={
        {
          ...paletteToCssVars(palette),
          ...(font ? fontToCssVars(font) : {}),
        } as React.CSSProperties
      }
      className={cx("bg-linen font-sans text-ink", className)}
    >
      {children}
    </div>
  );
}

interface Placement {
  /** How the type block is pinned inside the frame. */
  box: string;
  /** The type's own alignment, and the scroll cue's with it. */
  align: string;
  /** Rows within the block, so a centred name is not a left-aligned column. */
  items: string;
  /**
   * Which edge the type sits against. Decides the wash, the padding, the safe
   * area, and which way the empty frame's label is pushed to keep clear of the
   * name. `none` is the middle of the photograph, against no edge at all.
   */
  edge: "bottom" | "top" | "none";
}

const PLACEMENTS: Record<CoverPosition, Placement> = {
  "bottom-left": {
    box: "inset-x-0 bottom-0",
    align: "",
    items: "",
    edge: "bottom",
  },
  "bottom-centre": {
    box: "inset-x-0 bottom-0",
    align: "text-center",
    items: "items-center",
    edge: "bottom",
  },
  centre: {
    box: "inset-0 flex flex-col justify-center",
    align: "text-center",
    items: "items-center",
    edge: "none",
  },
  "top-left": {
    box: "inset-x-0 top-0",
    align: "",
    items: "",
    edge: "top",
  },
};

/**
 * The washes, keyed by the edge the type sits against.
 *
 * The wash is not decoration - it is the only thing making white type legible
 * on a photograph nobody has seen. Move the type without moving this and the
 * name disappears on any bright picture, so the position picks both.
 *
 * `bottom` is the one every cover had, at its own stops: a host who never
 * opens this setting gets exactly the page they had before it existed.
 */
const WASHES: Record<Placement["edge"], string> = {
  bottom:
    "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.42) 27%, rgba(0,0,0,0.04) 58%, rgba(0,0,0,0.12) 100%)",
  top: "linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.42) 27%, rgba(0,0,0,0.04) 58%, rgba(0,0,0,0.12) 100%)",
  /* Nothing to hang off at either edge, so this one is a scrim under the type
     itself, with a little over the whole frame to catch a white sky. */
  none: "radial-gradient(78% 46% at 50% 50%, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.22) 72%, rgba(0,0,0,0) 100%), linear-gradient(to top, rgba(0,0,0,0.24), rgba(0,0,0,0.18))",
};

/**
 * The banner's own, lighter. It carries a date and a name rather than a whole
 * page of type, over a strip a fifth of the height - the full cover's wash on
 * it reads as a darkened photograph rather than a legible one.
 */
const BANNER_WASHES: Record<Placement["edge"], string> = {
  bottom:
    "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0) 100%)",
  top: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0) 100%)",
  none: "radial-gradient(72% 58% at 50% 50%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 74%, rgba(0,0,0,0) 100%), linear-gradient(to top, rgba(0,0,0,0.18), rgba(0,0,0,0.14))",
};

export interface CoverProps {
  variant: CoverVariant;
  name: string;
  date: string;
  message?: string | null;
  coverUrl?: string | null;
  palette: Palette;
  /** Where the type sits on the photograph. Nothing to sit on without one. */
  position?: CoverPosition;
  /**
   * Compact rendering for the dashboard preview. Its heights step with the `@`
   * container - the drawing itself, see EventPreview - not the window.
   */
  preview?: boolean;
  /** What the empty photo slot says. Preview only; a guest never sees one. */
  photoLabel?: string;
}

export function EventCover(props: CoverProps) {
  // "Just type" is the only variant that works with no photo, so it is the
  // fallback for the others until the host picks one. The preview is the
  // exception: falling back there would render all four choices identically,
  // which reads as four broken buttons rather than a considered fallback.
  const variant =
    props.variant !== "type" && !props.coverUrl && !props.preview
      ? "type"
      : props.variant;

  switch (variant) {
    case "classic":
      return <ClassicCover {...props} />;
    case "half":
      return <PhotoCover {...props} half />;
    case "type":
      return <TypeCover {...props} />;
    default:
      return <PhotoCover {...props} />;
  }
}

function Title({
  name,
  date,
  message,
  preview,
  hero,
  centred,
  className,
}: {
  name: string;
  date: string;
  message?: string | null;
  preview?: boolean;
  /** The full-screen cover, where the name has the whole phone to itself. */
  hero?: boolean;
  /**
   * Centred type. The message is the only part that needs telling: it is held
   * to `max-w-xl`, and a narrow box of centred lines hung off the left edge
   * under a centred name is the thing that reads as a mistake.
   */
  centred?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="eyebrow">{formatEventDate(date)}</p>
      {/* Starts smaller on a phone and steps up, so it survives both "Ana and
          Marko" and "The Thirtieth Birthday of Someone". */}
      <h1
        className={cx(
          "mt-2 leading-[0.98]",
          preview
            ? hero
              ? "text-[1.75rem]"
              : "text-[1.5rem]"
            : hero
              ? "text-[2.5rem] xs:text-[3rem] sm:text-[4rem] lg:text-[4.75rem]"
              : "text-[2.125rem] xs:text-[2.5rem] sm:text-[3.25rem] lg:text-[4rem]",
        )}
      >
        {name}
      </h1>
      {/* Clamped in the preview: a host who wrote four sentences is still owed
          a drawing that fits on the screen they are editing it on. */}
      {message && (
        <p
          className={cx(
            "text-ash",
            preview
              ? "mt-1.5 line-clamp-2 text-micro leading-snug"
              : "mt-3 max-w-xl text-body sm:mt-4 sm:text-lead",
            centred && "mx-auto",
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * The photo, or the space it will occupy. The empty state only ever renders in
 * the host's preview, so it is a marked frame rather than an attempt at a
 * photograph.
 */
function CoverPhoto({
  url,
  label = "your photo",
  className,
  emptyClassName,
}: {
  url?: string | null;
  label?: string;
  className?: string;
  /** Only the empty frame: a photo must not be padded or it stops covering. */
  emptyClassName?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={cx("h-full w-full object-cover", className)}
      />
    );
  }

  return (
    <PhotoPlaceholder
      label={label}
      className={cx("h-full w-full rounded-none", className, emptyClassName)}
    />
  );
}

/**
 * The photograph with the name laid across the bottom, at the whole phone's
 * height or half of it.
 *
 * `svh` rather than `vh`: a phone's address bar is inside `vh` and outside
 * `svh`, so with `vh` the name sits under the browser chrome on first paint -
 * exactly what the cover exists to avoid.
 *
 * `flex-1` is the other half of that. The guest page puts this cover and the
 * platform header in one screen-high column, and `flex-1` takes the room the
 * header did not; a plain `h-svh` under a header is a screen and a bit, and the
 * bit that overflows is the name. Outside a flex column it does nothing.
 *
 * `half` carries no scroll cue and no safe-area padding: the ask is already on
 * the screen, and the foot of the cover is nowhere near the foot of the phone.
 */
function PhotoCover({
  name,
  date,
  message,
  coverUrl,
  preview,
  photoLabel,
  position = DEFAULT_POSITION,
  half,
}: CoverProps & {
  /** Half the screen rather than all of it. */
  half?: boolean;
}) {
  const place = PLACEMENTS[position];

  // Written out rather than assembled, because Tailwind reads this file for
  // literal class names and generates nothing for a string it cannot see.
  const pad =
    place.edge === "none"
      ? preview
        ? "py-3"
        : "py-10 sm:py-12"
      : place.edge === "top"
        ? preview
          ? "pt-3"
          : half
            ? "pt-6 sm:pt-8"
            : "pt-[max(2rem,env(safe-area-inset-top))] sm:pt-12"
        : preview
          ? "pb-3"
          : half
            ? "pb-6 sm:pb-8"
            : "pb-[max(2rem,env(safe-area-inset-bottom))] sm:pb-12";

  // The label in the empty frame is pushed clear of wherever the name is, or
  // the host's preview reads as two things printed over each other. Centred
  // type sends it downwards: at the middle it would be underneath.
  const empty =
    place.edge === "bottom"
      ? preview
        ? half
          ? "pb-14"
          : "pb-20"
        : half
          ? "pb-28"
          : "pb-40"
      : preview
        ? half
          ? "pt-14"
          : "pt-20"
        : half
          ? "pt-28"
          : "pt-40";

  // The cue points at what is under the cover, not at the name, so it stays at
  // the foot of the frame. It only trails the name when the name is down there
  // too - which is the cover every event has today, unchanged.
  const cueTrailsTitle = place.edge === "bottom";
  const sides = preview ? "px-4" : "px-4 sm:px-5";

  return (
    <header
      className={cx(
        // `z-10` so the shadow falls on the gallery rather than being painted
        // over by it - the panel below is a later sibling with a background.
        "relative z-10 overflow-hidden shadow-md",
        // A landscape phone is 375px tall, and half of that is not enough for
        // three lines of anything. The floors keep them from stacking.
        preview
          ? half
            ? "h-36 @xs:h-40 @sm:h-48"
            : "h-56 @xs:h-64 @sm:h-72"
          : half
            ? "h-[50svh] min-h-72"
            : "h-svh min-h-96 flex-1",
      )}
    >
      <div className="absolute inset-0">
        <CoverPhoto url={coverUrl} label={photoLabel} emptyClassName={empty} />
      </div>

      {/* Heaviest where the type is: a full-bleed photograph can be bright at
          any point in it, and the name is the thing that has to survive that. */}
      <div
        className="absolute inset-0"
        style={{ background: WASHES[place.edge] }}
      />

      <div
        className={cx(
          "absolute mx-auto max-w-3xl",
          place.box,
          place.align,
          sides,
          pad,
        )}
      >
        {/* Fixed light text: it sits on a photograph, not on the theme. */}
        <div className="text-white [&_.eyebrow]:text-white/75 [&_h1]:text-white [&_p]:text-white/85">
          <Title
            name={name}
            date={date}
            message={message}
            preview={preview}
            centred={place.items === "items-center"}
            hero
          />
          {!half && cueTrailsTitle && (
            <ScrollCue preview={preview} align={place.items} />
          )}
        </div>
      </div>

      {!half && !cueTrailsTitle && (
        <div
          className={cx(
            // The eyebrow keeps its own colour from the theme, so light type
            // on a photograph has to be asked for here exactly as it is in the
            // block above - without this the words go, and the arrow stays.
            "absolute inset-x-0 bottom-0 mx-auto max-w-3xl text-white [&_.eyebrow]:text-white/85",
            // Its own scrim, because the cover's has gone to the other end of
            // the photograph with the name: eleven characters of 11px type on
            // whatever the foot of the picture happens to be is nothing.
            "bg-linear-to-t from-black/55 to-transparent",
            place.align,
            sides,
            preview
              ? "pb-3 pt-8"
              : "pb-[max(2rem,env(safe-area-inset-bottom))] pt-16 sm:pb-12",
          )}
        >
          <ScrollCue preview={preview} align={place.items} />
        </div>
      )}
    </header>
  );
}

/** "There is more underneath this." */
function ScrollCue({
  preview,
  align,
}: {
  preview?: boolean;
  /** Follows the name: a centred name over a left-hung cue reads as a slip. */
  align?: string;
}) {
  return (
    <span
      className={cx(
        "flex items-center gap-2",
        align === "items-center" ? "justify-center" : undefined,
        preview ? "mt-2.5" : "mt-6 sm:mt-8",
      )}
    >
      <span className="eyebrow">add your photos</span>
      <svg
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className={cx("shrink-0", preview ? "h-3 w-3" : "h-4 w-4")}
      >
        <path
          d="M8 2v11M3.5 8.5 8 13l4.5-4.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Photo across the top with the name over it. */
function ClassicCover({
  name,
  date,
  message,
  coverUrl,
  preview,
  photoLabel,
  position = DEFAULT_POSITION,
}: CoverProps) {
  const place = PLACEMENTS[position];

  // A strip is 208px tall on a phone, so the same three positions are a
  // smaller move here than on a full screen - but the reason holds: the faces
  // in a banner crop are in the lower half of it too.
  const pad =
    place.edge === "none"
      ? preview
        ? "py-2"
        : "py-4 sm:py-5"
      : place.edge === "top"
        ? preview
          ? "pt-3"
          : "pt-[max(1.5rem,env(safe-area-inset-top))] sm:pt-7"
        : preview
          ? "pb-3"
          : "pb-6 sm:pb-7";

  const empty =
    place.edge === "bottom"
      ? preview
        ? "pb-12"
        : "pb-16"
      : preview
        ? "pt-12"
        : "pt-16";

  return (
    <header className="relative z-10 overflow-hidden shadow-md">
      <div
        className={cx(
          "relative w-full",
          // The drawing is compressed, but not by a fixed amount: the console's
          // column is three times wider on a laptop than on a phone, and a
          // cover that stays 128px tall inside it stops looking like a cover.
          preview ? "h-32 @2xs:h-36 @sm:h-44" : "h-52 xs:h-64 sm:h-80 lg:h-96",
        )}
      >
        <div className="absolute inset-0">
          {/* The empty frame's mark is pushed clear of the name rather than
              printed underneath it, whichever end the name is at. */}
          <CoverPhoto
            url={coverUrl}
            label={photoLabel}
            emptyClassName={empty}
          />
        </div>
        {/* One wash: it is there for the photograph under the type, not for
            the palette around it - so it follows the type to whichever end of
            the strip the type went to. */}
        <div
          className="absolute inset-0"
          style={{ background: BANNER_WASHES[place.edge] }}
        />
        <div
          className={cx(
            "absolute mx-auto max-w-3xl",
            place.box,
            place.align,
            preview ? "px-4" : "px-4 sm:px-5",
            pad,
          )}
        >
          {/* Fixed light text: it sits on a photograph, not on the theme. */}
          <div className="text-white [&_.eyebrow]:text-white/70 [&_h1]:text-white">
            <Title name={name} date={date} preview={preview} />
          </div>
        </div>
      </div>
      {message && (
        <div
          className={cx(
            "mx-auto max-w-3xl",
            preview ? "px-4 py-2" : "px-4 py-5 sm:px-5",
          )}
        >
          <p
            className={cx(
              "text-ash",
              preview
                ? "line-clamp-2 text-micro leading-snug"
                : "max-w-xl text-body sm:text-lead",
            )}
          >
            {message}
          </p>
        </div>
      )}
    </header>
  );
}

/** No photo. Large type on the theme colour, with the hole vocabulary. */
function TypeCover({ name, date, message, preview }: CoverProps) {
  return (
    <header className="relative z-10 bg-blush shadow-md">
      <div
        className={cx(
          "mx-auto max-w-3xl",
          preview ? "px-4 py-5" : "px-4 py-11 sm:px-5 sm:py-14",
        )}
      >
        <div className={cx("flex items-end", preview ? "gap-1.5" : "gap-3")}>
          <Hole size={preview ? 8 : 18} />
          <Hole size={preview ? 14 : 30} />
          <Hole size={preview ? 6 : 13} />
        </div>
        <Title
          name={name}
          date={date}
          message={message}
          preview={preview}
          className={preview ? "mt-2" : "mt-5 sm:mt-6"}
        />
      </div>
    </header>
  );
}
