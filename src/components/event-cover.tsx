import type { CoverVariant, Palette } from "@/lib/appearance";
import { paletteToCssVars } from "@/lib/appearance";
import type { FontSet } from "@/lib/fonts";
import { fontToCssVars } from "@/lib/fonts";
import { formatEventDate } from "@/lib/format";
import { Hole, PhotoPlaceholder, cx } from "@/components/ui";

/**
 * Re-skins everything inside it.
 *
 * The palette and the type pairing are applied as the same CSS custom
 * properties the design system already defines, so every existing component
 * underneath picks them up without knowing that themes exist. No component
 * takes a `theme` or a `font` prop.
 *
 * `font-sans` on the root matters: body copy inherits its family from <body>,
 * and an inherited declaration is not re-evaluated against a variable that this
 * element redefines. Naming the variable here is what makes the override apply
 * to the whole subtree.
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
      className={cx("bg-butter font-sans text-pepper", className)}
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
   * Compact rendering for the dashboard preview.
   *
   * The heights it picks step with the `@` container, which is the drawing
   * itself (see EventPreview), not the window. The drawing is a column beside
   * the controls now rather than the full width of the panel, and a cover that
   * grew with the host's screen while its own box stayed still ended up half
   * the height of a preview that is only 300px wide.
   */
  preview?: boolean;
  /**
   * What the empty photo slot says. Preview only - a guest never sees an empty
   * cover - and it is how the host is told a cover photo is still missing
   * without the drawing having to pretend it has one.
   */
  photoLabel?: string;
}

export function EventCover(props: CoverProps) {
  // "Just type" is the only variant that works with no photo, so it is also the
  // fallback for the others before the host has picked one - an empty grey
  // rectangle at the top of a wedding page is worse than no photo at all.
  //
  // The host's preview is the exception. Falling back there would render all
  // four choices identically until a cover photo existed, which reads as four
  // broken buttons rather than as a considered fallback. The preview shows the
  // shape that was picked with its photo slot marked empty, and the form says
  // in words what guests get until a photo is chosen.
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
      {/* An event name is arbitrary text the host typed, so it has to survive
          "Ana and Marko" and "The Thirtieth Birthday of Someone" alike. It
          starts smaller on a phone and steps up, rather than starting at the
          size that only works for two first names. */}
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
      {/* The welcome message is page content, so the drawing carries it too -
          clamped, because a host who wrote four sentences is owed a preview
          that still fits on the screen they are editing it on. */}
      {message && (
        <p
          className={cx(
            "text-crust",
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
 * The photo, or the space it will occupy.
 *
 * The empty state only ever renders in the host's preview - a guest page with
 * no cover photo has already fallen back to "Just type" - so it is a marked
 * frame rather than an attempt at a photograph: it is telling the host what
 * will sit there, in the same recess the real one will sit in.
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
 * The photograph with the name laid across the bottom of it, at one of two
 * heights: the whole phone, or half of it.
 *
 * The full one is the default, and the reason the page is worth scanning a code
 * for: a guest arrives holding a phone, and the first thing they get is the
 * event rather than a form. `svh` rather than `vh` because a phone's address bar
 * is inside `vh` and outside `svh` - with `vh` the name sits under the browser
 * chrome on first paint, which is exactly the thing the cover exists to avoid.
 *
 * `flex-1` is the other half of that. The page puts this cover and the header
 * above it in one screen-high column (see the guest page), and there `flex-1`
 * takes the room the header did not - a plain `h-svh` under a header is a
 * screen and a bit, and the bit that overflows is the name. Standing alone,
 * outside a flex column, `flex-1` does nothing and the height applies.
 *
 * Everything else on the page is then below the fold, so the cover has to say
 * that something is down there. That is the cue under the name; without it a
 * full-screen photo is indistinguishable from a page that failed to load the
 * rest of itself.
 *
 * `half` is the same drawing at half the height, for a host who wants the
 * photograph to open the page without the upload button being below the fold.
 * It carries no scroll cue and no safe-area padding for the same reason: the
 * ask is already on the screen, and the foot of the cover is nowhere near the
 * foot of the phone.
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
        // A landscape phone is 375px tall. The floors keep the name, the date
        // and the cue from stacking into each other there - half of 375px is
        // not enough room for three lines of anything.
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

      {/* Heavier at the foot than the banner's wash: there is more type down
          there, and a full-bleed photograph can be bright at any point in it. */}
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
          {/* The name sits along the bottom of this one, so the empty frame's
              mark is pushed clear of it rather than printed underneath. */}
          <CoverPhoto
            url={coverUrl}
            label={photoLabel}
            emptyClassName={preview ? "pb-12" : "pb-16"}
          />
        </div>
        {/* One wash, because every theme is light now: the wash is there for
            the photograph underneath the type, not for the palette around it. */}
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
              "text-crust",
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
    <header className="relative z-10 bg-gouda shadow-md">
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
