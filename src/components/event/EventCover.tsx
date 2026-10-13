import { CoverImage } from "@/components/event/CoverImage";
import type { Palette } from "@/lib/appearance/themes";
import {
  type CoverHorizontal,
  type CoverPosition,
  type CoverVariant,
  type CoverVertical,
  DEFAULT_POSITION,
  splitPosition,
} from "@/lib/appearance/variants";
import { paletteToCssVars } from "@/lib/appearance";
import type { FontSet } from "@/lib/fonts";
import { fontToCssVars } from "@/lib/fonts";
import { Hole, PhotoPlaceholder, cx } from "@/components/ui";

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
  box: string;
  align: string;
  horizontal: CoverHorizontal;
  edge: "bottom" | "top" | "none";
}

/* Written out rather than assembled: Tailwind only sees literal class names. */
const BOXES: Record<CoverVertical, string> = {
  top: "inset-x-0 top-0",
  middle: "inset-0 flex flex-col justify-center",
  bottom: "inset-x-0 bottom-0",
};

const ALIGNS: Record<CoverHorizontal, string> = {
  left: "text-left",
  centre: "text-center",
  right: "text-right",
};

const CUE_JUSTIFY: Record<CoverHorizontal, string> = {
  left: "justify-start",
  centre: "justify-center",
  right: "justify-end",
};

const EDGES: Record<CoverVertical, Placement["edge"]> = {
  top: "top",
  middle: "none",
  bottom: "bottom",
};

function placementFor(position: CoverPosition): Placement {
  const { vertical, horizontal } = splitPosition(position);
  return {
    box: BOXES[vertical],
    align: ALIGNS[horizontal],
    horizontal,
    edge: EDGES[vertical],
  };
}

const WASHES: Record<"bottom" | "top", string> = {
  bottom:
    "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.42) 27%, rgba(0,0,0,0.04) 58%, rgba(0,0,0,0.12) 100%)",
  top: "linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.42) 27%, rgba(0,0,0,0.04) 58%, rgba(0,0,0,0.12) 100%)",
};

const CENTRE_WASHES: Record<CoverHorizontal, string> = {
  left: "radial-gradient(78% 46% at 26% 50%, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.22) 72%, rgba(0,0,0,0) 100%), linear-gradient(to top, rgba(0,0,0,0.24), rgba(0,0,0,0.18))",
  centre:
    "radial-gradient(78% 46% at 50% 50%, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.22) 72%, rgba(0,0,0,0) 100%), linear-gradient(to top, rgba(0,0,0,0.24), rgba(0,0,0,0.18))",
  right:
    "radial-gradient(78% 46% at 74% 50%, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.22) 72%, rgba(0,0,0,0) 100%), linear-gradient(to top, rgba(0,0,0,0.24), rgba(0,0,0,0.18))",
};

const BANNER_CENTRE_WASHES: Record<CoverHorizontal, string> = {
  left: "radial-gradient(72% 58% at 26% 50%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 74%, rgba(0,0,0,0) 100%), linear-gradient(to top, rgba(0,0,0,0.18), rgba(0,0,0,0.14))",
  centre:
    "radial-gradient(72% 58% at 50% 50%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 74%, rgba(0,0,0,0) 100%), linear-gradient(to top, rgba(0,0,0,0.18), rgba(0,0,0,0.14))",
  right:
    "radial-gradient(72% 58% at 74% 50%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 74%, rgba(0,0,0,0) 100%), linear-gradient(to top, rgba(0,0,0,0.18), rgba(0,0,0,0.14))",
};

const BANNER_WASHES: Record<"bottom" | "top", string> = {
  bottom:
    "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0) 100%)",
  top: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0) 100%)",
};

function washFor(place: Placement): string {
  return place.edge === "none"
    ? CENTRE_WASHES[place.horizontal]
    : WASHES[place.edge];
}

function bannerWashFor(place: Placement): string {
  return place.edge === "none"
    ? BANNER_CENTRE_WASHES[place.horizontal]
    : BANNER_WASHES[place.edge];
}

export interface CoverProps {
  variant: CoverVariant;
  name: string;
  coverUrl?: string | null;
  coverPreviewUrl?: string | null;
  palette: Palette;
  position?: CoverPosition;
  preview?: boolean;
  embedded?: boolean;
  photoLabel?: string;
}

export function EventCover(props: CoverProps) {
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
  preview,
  hero,
  className,
}: {
  name: string;
  preview?: boolean;
  hero?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <h1
        className={cx(
          "leading-[0.98]",
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
    </div>
  );
}

function CoverPhoto({
  url,
  previewUrl,
  label = "your photo",
  className,
  emptyClassName,
  preview,
}: {
  url?: string | null;
  previewUrl?: string | null;
  label?: string;
  className?: string;
  emptyClassName?: string;
  preview?: boolean;
}) {
  if (url && !preview) {
    return <CoverImage url={url} previewUrl={previewUrl} className={className} />;
  }

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
 * `svh` rather than `vh`: a phone's address bar is inside `vh`, which would put the
 * name under the browser chrome.
 */
function PhotoCover({
  name,
  coverUrl,
  coverPreviewUrl,
  preview,
  embedded,
  photoLabel,
  position = DEFAULT_POSITION,
  half,
}: CoverProps & {
  half?: boolean;
}) {
  const place = placementFor(position);

  // Written out rather than assembled: Tailwind only sees literal class names.
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

  const cueTrailsTitle = place.edge === "bottom";
  const sides = preview ? "px-4" : "px-4 sm:px-5";

  return (
    <header
      className={cx(
        "relative z-10 overflow-hidden shadow-md",
        preview
          ? half
            ? "h-36 @xs:h-40 @sm:h-48"
            : "h-56 @xs:h-64 @sm:h-72"
          : half
            ? "h-[50svh] min-h-72"
            : embedded
              ? "h-[60svh] min-h-80"
              : "h-svh min-h-96 flex-1",
      )}
    >
      <div className="absolute inset-0">
        <CoverPhoto
          url={coverUrl}
          previewUrl={coverPreviewUrl}
          label={photoLabel}
          emptyClassName={empty}
          preview={preview}
        />
      </div>

      <div
        className="absolute inset-0"
        style={{ background: washFor(place) }}
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
        <div className="text-white [&_.eyebrow]:text-white/75 [&_h1]:text-white [&_p]:text-white/85">
          <Title name={name} preview={preview} hero />
          {!half && cueTrailsTitle && (
            <ScrollCue preview={preview} horizontal={place.horizontal} />
          )}
        </div>
      </div>

      {!half && !cueTrailsTitle && (
        /* The wash spans the cover; only the cue inside it is held to the text column. */
        <div
          className={cx(
            "absolute inset-x-0 bottom-0 text-white [&_.eyebrow]:text-white/85",
            "bg-linear-to-t from-black/55 to-transparent",
            preview
              ? "pb-3 pt-8"
              : "pb-[max(2rem,env(safe-area-inset-bottom))] pt-16 sm:pb-12",
          )}
        >
          <div className={cx("mx-auto max-w-3xl", place.align, sides)}>
            <ScrollCue preview={preview} horizontal={place.horizontal} />
          </div>
        </div>
      )}
    </header>
  );
}

function ScrollCue({
  preview,
  horizontal = "left",
}: {
  preview?: boolean;
  horizontal?: CoverHorizontal;
}) {
  return (
    <span
      className={cx(
        "flex items-center gap-2",
        CUE_JUSTIFY[horizontal],
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

function ClassicCover({
  name,
  coverUrl,
  coverPreviewUrl,
  preview,
  photoLabel,
  position = DEFAULT_POSITION,
}: CoverProps) {
  const place = placementFor(position);

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
          preview ? "h-32 @2xs:h-36 @sm:h-44" : "h-52 xs:h-64 sm:h-80 lg:h-96",
        )}
      >
        <div className="absolute inset-0">
          <CoverPhoto
            url={coverUrl}
            previewUrl={coverPreviewUrl}
            label={photoLabel}
            emptyClassName={empty}
            preview={preview}
          />
        </div>
        <div
          className="absolute inset-0"
          style={{ background: bannerWashFor(place) }}
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
          <div className="text-white [&_.eyebrow]:text-white/70 [&_h1]:text-white">
            <Title name={name} preview={preview} />
          </div>
        </div>
      </div>
    </header>
  );
}

function TypeCover({ name, preview }: CoverProps) {
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
          preview={preview}
          className={preview ? "mt-2" : "mt-5 sm:mt-6"}
        />
      </div>
    </header>
  );
}
