import type { CoverVariant, Palette } from "@/lib/appearance";
import { paletteToCssVars } from "@/lib/appearance";
import { isDark } from "@/lib/color";
import { formatEventDate } from "@/lib/format";
import { Hole, cx } from "@/components/ui";

/**
 * Re-skins everything inside it.
 *
 * The palette is applied as the same CSS custom properties the design system
 * already defines, so every existing component underneath picks up the theme
 * without knowing that themes exist. No component takes a `theme` prop.
 */
export function EventThemeRoot({
  palette,
  className,
  children,
}: {
  palette: Palette;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={paletteToCssVars(palette) as React.CSSProperties}
      className={cx("bg-butter text-pepper", className)}
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
  /** Compact rendering for the dashboard preview. */
  preview?: boolean;
}

export function EventCover(props: CoverProps) {
  // "Just type" is the only variant that works with no photo, so it is also the
  // fallback for the others before the host has picked one - an empty grey
  // rectangle at the top of a wedding page is worse than no photo at all.
  const variant =
    props.variant !== "type" && !props.coverUrl ? "type" : props.variant;

  switch (variant) {
    case "band":
      return <BandCover {...props} />;
    case "framed":
      return <FramedCover {...props} />;
    case "type":
      return <TypeCover {...props} />;
    default:
      return <ClassicCover {...props} />;
  }
}

function Title({
  name,
  date,
  message,
  preview,
  className,
}: {
  name: string;
  date: string;
  message?: string | null;
  preview?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="eyebrow">{formatEventDate(date)}</p>
      <h1
        className={cx(
          "mt-2 leading-[0.98]",
          preview ? "text-[1.5rem]" : "text-[2.75rem] sm:text-[4rem]",
        )}
      >
        {name}
      </h1>
      {message && !preview && (
        <p className="mt-4 max-w-xl text-lead text-crust">{message}</p>
      )}
    </div>
  );
}

/** Photo across the top with the name over it. */
function ClassicCover({
  name,
  date,
  message,
  coverUrl,
  palette,
  preview,
}: CoverProps) {
  // The scrim direction follows the theme: light text needs a dark wash under
  // it, and on a light theme the opposite reads as a mistake.
  const dark = isDark(palette.bg);

  return (
    <header className="relative overflow-hidden border-b-2 border-pepper">
      <div className={cx("relative w-full", preview ? "h-28" : "h-64 sm:h-96")}>
        {coverUrl && (
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: dark
              ? "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.1) 100%)"
              : "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div
          className={cx(
            "absolute inset-x-0 bottom-0 mx-auto max-w-3xl",
            preview ? "px-4 pb-3" : "px-5 pb-7",
          )}
        >
          {/* Fixed light text: it sits on a photograph, not on the theme. */}
          <div className="text-white [&_.eyebrow]:text-white/70 [&_h1]:text-white">
            <Title name={name} date={date} preview={preview} />
          </div>
        </div>
      </div>
      {message && !preview && (
        <div className="mx-auto max-w-3xl px-5 py-5">
          <p className="max-w-xl text-lead text-crust">{message}</p>
        </div>
      )}
    </header>
  );
}

/** Photo above a solid band of accent carrying the name. */
function BandCover({
  name,
  date,
  message,
  coverUrl,
  preview,
}: CoverProps) {
  return (
    <header className="border-b-2 border-pepper">
      <div
        className={cx(
          "relative w-full overflow-hidden border-b-2 border-pepper",
          preview ? "h-20" : "h-52 sm:h-72",
        )}
      >
        {coverUrl && (
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="bg-gouda">
        <div
          className={cx(
            "mx-auto max-w-3xl",
            preview ? "px-4 py-3" : "px-5 py-8",
          )}
        >
          <Title
            name={name}
            date={date}
            message={message}
            preview={preview}
          />
        </div>
      </div>
    </header>
  );
}

/** Photo as a card with a hard shadow, name beside it. The slab, at cover size. */
function FramedCover({
  name,
  date,
  message,
  coverUrl,
  preview,
}: CoverProps) {
  return (
    <header className="border-b-2 border-pepper bg-butter">
      <div
        className={cx(
          "mx-auto grid max-w-3xl items-center gap-6",
          preview ? "px-4 py-4 grid-cols-[1fr_1.1fr]" : "px-5 py-10 sm:grid-cols-[1fr_1.1fr]",
        )}
      >
        <div
          className={cx(
            "overflow-hidden rounded-[1.25rem] border-2 border-pepper bg-cream",
            preview
              ? "shadow-[4px_4px_0_var(--color-pepper)]"
              : "shadow-[7px_7px_0_var(--color-pepper)]",
          )}
        >
          {coverUrl && (
            <img
              src={coverUrl}
              alt=""
              className={cx(
                "w-full object-cover",
                preview ? "h-20" : "h-56 sm:h-72",
              )}
            />
          )}
        </div>
        <Title name={name} date={date} message={message} preview={preview} />
      </div>
    </header>
  );
}

/** No photo. Large type on the theme colour, with the hole vocabulary. */
function TypeCover({ name, date, message, preview }: CoverProps) {
  return (
    <header className="border-b-2 border-pepper bg-gouda">
      <div
        className={cx("mx-auto max-w-3xl", preview ? "px-4 py-5" : "px-5 py-14")}
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
          className={preview ? "mt-2" : "mt-6"}
        />
      </div>
    </header>
  );
}
