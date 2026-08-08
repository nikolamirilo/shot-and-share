import { EventCover, EventThemeRoot } from "@/components/event-cover";
import { LogoMark } from "@/components/logo";
import { UploadPanel } from "@/components/upload-panel";
import { Hole, PhotoPlaceholder, cx } from "@/components/ui";
import type { CoverVariant, Palette, UploadVariant } from "@/lib/appearance";
import type { FontSet } from "@/lib/fonts";
import { GALLERY_LAYOUTS, type GalleryLayout, holeSize } from "@/lib/gallery";

/**
 * A drawing of the guest page, at the size of a panel in the host's console.
 *
 * It is the whole page rather than a sample of it - the browser frame, the
 * header, the cover, the ask, the gallery with its switcher, the small print at
 * the bottom - because "what does Midnight look like?" is a question about a
 * page, and a swatch of a page cannot answer it. Every piece here is either the
 * real component (EventCover, UploadPanel) or the real markup at a smaller
 * size, sitting under the real EventThemeRoot, so a colour that does nothing
 * visible in this box does nothing on the page either.
 *
 * Two deliberate departures from the guest page:
 *
 *  - **No photographs.** Every tile is an empty frame with a picture mark in
 *    it. The host is judging the shape of the gallery and the colours around
 *    it, and their guests' faces are the one thing that would answer that
 *    question with something else. It also means the preview costs no image
 *    requests at all, however often a swatch is clicked.
 *  - **The gallery is clipped.** A page of photos is taller than a preview can
 *    be, so the wall runs into a fade the way it runs off the bottom of a
 *    phone. Each layout keeps its own real geometry inside that window.
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
  /** What may be sent, worded exactly as the guest page words it. */
  uploadHint: string;
  /** The host's own switch: no gallery on the page, none in the drawing. */
  galleryVisible: boolean;
  /** Whether a cover photo has been chosen, which the empty frame says. */
  coverChosen: boolean;
  /** Shown in the address bar. Falls back to a neutral label. */
  shareLink?: string | null;
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
  uploadHint,
  galleryVisible,
  coverChosen,
  shareLink,
}: EventPreviewProps) {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-pepper">
      <BrowserBar shareLink={shareLink} />

      {/* A picture of a page, not a page. Nothing inside can be clicked,
          focused or read out: it would put a second "Add your photos" in the
          host's tab order, inside a form that saves. */}
      <div aria-hidden inert>
        <EventThemeRoot palette={palette} font={font}>
          <header className="border-b-2 border-pepper">
            <div className="mx-auto flex max-w-3xl px-3 py-1.5 sm:px-4">
              <LogoMark className="h-6 w-auto" />
            </div>
          </header>

          <EventCover
            variant={cover}
            name={name}
            date={date}
            message={message}
            /* Never the real photo - see the note at the top of the file. The
               label is how the host is told one is still missing. */
            coverUrl={null}
            photoLabel={coverChosen ? "your photo" : "no photo yet"}
            palette={palette}
            preview
          />

          <main className="mx-auto max-w-3xl px-3 pb-4 pt-3 sm:px-4 sm:pb-5 sm:pt-4">
            <UploadPanel
              variant={upload}
              label="Add your photos"
              hint={uploadHint}
              name=""
              preview
            />

            {galleryVisible && (
              <section className="mt-4 sm:mt-5">
                <h2 className="text-body leading-tight">
                  Everyone&apos;s photos
                </h2>

                {/* The guest's own switch. It is in the drawing because it is
                    on the page, and because it says which layout is the one
                    being looked at. */}
                <div className="mt-2 flex justify-end overflow-hidden">
                  <LayoutPills value={layout} />
                </div>

                {/* One window, whatever is in it: the wall runs into a fade
                    the way it runs off the bottom of a phone, and every layout
                    is then judged in the same amount of room. It grows with
                    the console's own column, where the tiles are larger. */}
                <div className="relative mt-2 h-40 overflow-hidden xs:h-48 sm:h-52 lg:h-60">
                  <PreviewGallery layout={layout} />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-butter to-transparent" />
                </div>
              </section>
            )}
          </main>

          <div className="border-t-2 border-pepper">
            <p className="mx-auto max-w-3xl px-3 py-2 text-[0.625rem] leading-snug text-rind sm:px-4">
              Photos you add here go to the host of this event.
            </p>
          </div>
        </EventThemeRoot>
      </div>
    </div>
  );
}

/**
 * The window the page is in.
 *
 * It sits outside the theme root on purpose and keeps the console's own
 * colours: it is the browser, not the page, and a chrome bar that changed
 * colour with the theme would be one more thing the host has to mentally
 * subtract from what they are judging.
 */
function BrowserBar({ shareLink }: { shareLink?: string | null }) {
  return (
    <div className="flex items-center gap-2 border-b-2 border-pepper bg-butter px-2.5 py-1.5">
      <span className="flex shrink-0 gap-1">
        <Hole size={7} />
        <Hole size={7} />
        <Hole size={7} />
      </span>
      <span className="min-w-0 flex-1 truncate rounded-full border-2 border-pepper bg-cream px-2.5 py-0.5 text-center font-mono text-[0.625rem] tracking-wide text-rind">
        {addressLabel(shareLink)}
      </span>
    </div>
  );
}

function addressLabel(link?: string | null): string {
  if (!link) return "your event page";
  try {
    const url = new URL(link);
    return `${url.host}${url.pathname}`;
  } catch {
    return link;
  }
}

/** The viewer's layout switcher, drawn rather than wired. */
function LayoutPills({ value }: { value: GalleryLayout }) {
  return (
    <span className="flex shrink-0 overflow-hidden rounded-full border-2 border-pepper">
      {GALLERY_LAYOUTS.map((option) => (
        <span
          key={option.id}
          className={cx(
            "px-2 py-0.5 text-[0.625rem] font-semibold leading-tight",
            value === option.id
              ? "bg-pepper text-butter"
              : "bg-cream text-pepper",
          )}
        >
          {option.name}
        </span>
      ))}
    </span>
  );
}

/**
 * The four walls, in miniature.
 *
 * Each one keeps the geometry its real counterpart in PhotoGallery has - equal
 * squares, ragged columns, the uneven circle sequence, one photo at a time -
 * because that geometry *is* the choice being made. Drawing all four as a row
 * of squares, which is what this used to do, made three of the four buttons
 * look broken.
 *
 * The column counts are a phone's. Guests arrive by scanning a code with the
 * thing in their hand, so a phone is the honest window to draw.
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
      <div className="flex flex-wrap items-center gap-1.5 xs:gap-2">
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
      <div className="columns-2 gap-1.5 xs:columns-3 xs:gap-2 lg:columns-4">
        {SKETCH_RATIOS.map((ratio, i) => (
          <PhotoPlaceholder
            key={i}
            className="mb-1.5 w-full break-inside-avoid xs:mb-2"
            style={{ aspectRatio: ratio }}
          />
        ))}
      </div>
    );
  }

  if (layout === "stack") {
    // Wide enough that the second row starts inside the window: one photo at a
    // time is the point of Stack, and one photo filling the whole frame with
    // nothing under it reads as a broken gallery rather than as a tall one.
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
    <div className="grid grid-cols-3 gap-1.5 xs:grid-cols-4 xs:gap-2">
      {Array.from({ length: 12 }).map((_, i) => (
        <PhotoPlaceholder key={i} className="aspect-square w-full" />
      ))}
    </div>
  );
}
