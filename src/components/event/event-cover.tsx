import type { Palette } from "@/lib/appearance/themes";
import type { CoverVariant } from "@/lib/appearance/variants";
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

export interface CoverProps {
  variant: CoverVariant;
  name: string;
  date: string;
  message?: string | null;
  coverUrl?: string | null;
  palette: Palette;
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
  className,
}: {
  name: string;
  date: string;
  message?: string | null;
  preview?: boolean;
  /** The full-screen cover, where the name has the whole phone to itself. */
  hero?: boolean;
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
  half,
}: CoverProps & {
  /** Half the screen rather than all of it. */
  half?: boolean;
}) {
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
        <CoverPhoto
          url={coverUrl}
          label={photoLabel}
          emptyClassName={
            preview ? (half ? "pb-14" : "pb-20") : half ? "pb-28" : "pb-40"
          }
        />
      </div>

      {/* Heavier at the foot: there is more type down there, and a full-bleed
          photograph can be bright at any point in it. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.42) 27%, rgba(0,0,0,0.04) 58%, rgba(0,0,0,0.12) 100%)",
        }}
      />

      <div
        className={cx(
          "absolute inset-x-0 bottom-0 mx-auto max-w-3xl",
          preview
            ? "px-4 pb-3"
            : half
              ? "px-4 pb-6 sm:px-5 sm:pb-8"
              : "px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-12",
        )}
      >
        {/* Fixed light text: it sits on a photograph, not on the theme. */}
        <div className="text-white [&_.eyebrow]:text-white/75 [&_h1]:text-white [&_p]:text-white/85">
          <Title
            name={name}
            date={date}
            message={message}
            preview={preview}
            hero
          />
          {!half && <ScrollCue preview={preview} />}
        </div>
      </div>
    </header>
  );
}

/** "There is more underneath this." */
function ScrollCue({ preview }: { preview?: boolean }) {
  return (
    <span
      className={cx(
        "flex items-center gap-2",
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
}: CoverProps) {
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
          {/* The name sits along the bottom, so the empty frame's mark is
              pushed clear of it rather than printed underneath. */}
          <CoverPhoto
            url={coverUrl}
            label={photoLabel}
            emptyClassName={preview ? "pb-12" : "pb-16"}
          />
        </div>
        {/* One wash: it is there for the photograph under the type, not for
            the palette around it. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div
          className={cx(
            "absolute inset-x-0 bottom-0 mx-auto max-w-3xl",
            preview ? "px-4 pb-3" : "px-4 pb-6 sm:px-5 sm:pb-7",
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
