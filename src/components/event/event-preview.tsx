import { EventCover, EventThemeRoot } from "@/components/event/event-cover";
import { UploadPanel } from "@/components/upload/upload-panel";
import { PhotoPlaceholder } from "@/components/ui";
import type { Palette } from "@/lib/appearance/themes";
import type { CoverVariant, UploadVariant } from "@/lib/appearance/variants";
import type { FontSet } from "@/lib/fonts";
import { type GalleryLayout, holeSize } from "@/lib/gallery";
import type { UploadWording } from "@/lib/media";

/**
 * A drawing of the whole guest page, at the size of a console panel.
 *
 * Every piece is either the real component (EventCover, UploadPanel) or the
 * real markup smaller, under the real EventThemeRoot - so a colour that does
 * nothing visible here does nothing on the page either.
 *
 * The box is an `@container`: everything breaks against the drawing rather than
 * the window, because what decides how many photos fit across it is how wide
 * *it* is, not how wide the host's screen is.
 *
 * Two departures from the guest page. The gallery holds empty frames rather
 * than photographs - the host is judging the shape of the wall, and their
 * guests' faces would answer a different question at an image request per tile.
 * The cover is the exception, because it *is* a particular photograph and they
 * are choosing between four crops of it. And the wall is clipped into a fade,
 * the way it runs off the bottom of a phone.
 */

export interface EventPreviewProps {
  name: string;
  date: string;
  message?: string | null;
  palette: Palette;
  font: FontSet;
  cover: CoverVariant;
  upload: UploadVariant;
  layout: GalleryLayout;
  /** How the guest page words the ask, so the drawing says the same thing. */
  wording: UploadWording;
  /** The host's own switch: no gallery on the page, none in the drawing. */
  galleryVisible: boolean;
  /** Whether a cover photo has been chosen, which the empty frame says. */
  coverChosen: boolean;
  /** The chosen cover photo itself. The only photograph in the drawing. */
  coverUrl?: string | null;
}

export function EventPreview({
  name,
  date,
  message,
  palette,
  font,
  cover,
  upload,
  layout,
  wording,
  galleryVisible,
  coverChosen,
  coverUrl,
}: EventPreviewProps) {
  return (
    <div className="@container overflow-hidden rounded-xl shadow-md">
      {/* A picture of a page, not a page: nothing inside can be clicked,
          focused or read out. */}
      <div aria-hidden inert>
        <EventThemeRoot palette={palette} font={font}>
          <EventCover
            variant={cover}
            name={name}
            date={date}
            message={message}
            /* The one real photograph in the drawing. The label fills the
               frame until they have picked one. */
            coverUrl={coverUrl ?? null}
            photoLabel={coverChosen ? "your photo" : "no photo yet"}
            palette={palette}
            preview
          />

          <main className="mx-auto max-w-3xl px-3 pb-4 pt-3 @sm:px-4 @sm:pb-5 @sm:pt-4">
            <UploadPanel
              variant={upload}
              label={wording.action}
              captureLabel={wording.capture}
              chooseLabel={wording.choose}
              hint={wording.hint}
              name=""
              preview
            />

            {galleryVisible && (
              <section className="mt-4 @sm:mt-5">
                <h2 className="text-body leading-tight">
                  Everyone&apos;s photos
                </h2>

                {/* One window, whatever is in it, so every layout is judged in
                    the same amount of room. */}
                <div className="relative mt-2 h-40 overflow-hidden @xs:h-48 @sm:h-52 @lg:h-60">
                  <PreviewGallery layout={layout} />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-linen to-transparent" />
                </div>
              </section>
            )}
          </main>
        </EventThemeRoot>
      </div>
    </div>
  );
}

/**
 * The four walls in miniature. Each keeps the geometry its counterpart in
 * PhotoGallery has, because that geometry *is* the choice being made.
 *
 * Column counts are a phone's, measured off the drawing rather than the screen:
 * a 320px drawing on a laptop laying photos out four across is a wall no guest
 * would ever see.
 */
const SKETCH_RATIOS = [1, 0.74, 1.34, 0.82, 1, 1.5, 0.72, 1.12, 0.9];

/**
 * The circle sequence, scaled to the frame. Enough of them that the wall wraps
 * and its rhythm is readable - a single row of circles is a row of buttons.
 */
const HOLE_SCALE = 0.42;
const HOLE_COUNT = 26;

function PreviewGallery({ layout }: { layout: GalleryLayout }) {
  if (layout === "holes") {
    return (
      <div className="flex flex-wrap items-center gap-1.5 @sm:gap-2">
        {Array.from({ length: HOLE_COUNT }).map((_, i) => {
          const size = Math.round(holeSize(i) * HOLE_SCALE);
          return (
            <PhotoPlaceholder
              key={i}
              shape="hole"
              style={{ width: size, height: size }}
            />
          );
        })}
      </div>
    );
  }

  if (layout === "masonry") {
    return (
      <div className="columns-2 gap-1.5 @sm:columns-3 @sm:gap-2 @lg:columns-4">
        {SKETCH_RATIOS.map((ratio, i) => (
          <PhotoPlaceholder
            key={i}
            className="mb-1.5 w-full break-inside-avoid @sm:mb-2"
            style={{ aspectRatio: ratio }}
          />
        ))}
      </div>
    );
  }

  if (layout === "stack") {
    // Wide enough that the second row starts inside the window: one photo
    // filling the frame with nothing under it reads as a broken gallery.
    return (
      <div className="mx-auto max-w-md space-y-2">
        {[1.75, 1.2].map((ratio, i) => (
          <PhotoPlaceholder
            key={i}
            className="w-full"
            style={{ aspectRatio: ratio }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1.5 @sm:grid-cols-4 @sm:gap-2">
      {Array.from({ length: 12 }).map((_, i) => (
        <PhotoPlaceholder key={i} className="aspect-square w-full" />
      ))}
    </div>
  );
}
