import { EventCover, EventThemeRoot } from "@/components/event-cover";
import { UploadPanel } from "@/components/upload-panel";
import { PhotoPlaceholder } from "@/components/ui";
import type { CoverVariant, Palette, UploadVariant } from "@/lib/appearance";
import type { FontSet } from "@/lib/fonts";
import { type GalleryLayout, holeSize } from "@/lib/gallery";

/**
 * A drawing of the guest page, at the size of a panel in the host's console.
 *
 * It is the whole page rather than a sample of it - the cover, the ask, the
 * gallery - because "what does Midnight look like?" is a question about a page,
 * and a swatch of a page cannot answer it. Every piece here is either the real
 * component (EventCover, UploadPanel) or the real markup at a smaller size,
 * sitting under the real EventThemeRoot, so a colour that does nothing visible
 * in this box does nothing on the page either.
 *
 * The box is a container, and everything inside it breaks against the box
 * rather than against the window. It sits in a column about a phone wide beside
 * the controls, so a `sm:` in here would ask the wrong question: whether the
 * host's screen is wide, when what decides how many photos fit across the
 * drawing is how wide the drawing is.
 *
 * There was a browser chrome bar across the top of it, with the share link in
 * an address field. It said nothing the host did not know - they are looking at
 * their own event page, and the link has a panel of its own - and it cost the
 * drawing a strip of height in a column that no longer has any to spare.
 *
 * There is no header and no small print, because there are none on the page
 * this draws. The panel is locked behind an upsell on the free plan, so every
 * event that reaches this component is paid, and a paid guest page carries
 * nothing of ours above the cover or below the gallery.
 *
 * Two deliberate departures from the guest page:
 *
 *  - **No photographs in the gallery.** Every tile is an empty frame with a
 *    picture mark in it. The host is judging the shape of the wall and the
 *    colours around it, and fifty of their guests' faces are the one thing that
 *    would answer that question with something else - and it would cost an
 *    image request per tile every time a swatch is clicked.
 *
 *    The cover is the exception, and it is not really one: the cover *is* a
 *    particular photograph the host picked, so a grey frame there answers the
 *    wrong question. They are choosing between four crops of their own picture,
 *    which is impossible to judge without the picture.
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
  uploadHint,
  galleryVisible,
  coverChosen,
  coverUrl,
}: EventPreviewProps) {
  return (
    <div className="@container overflow-hidden rounded-xl shadow-md">
      {/* A picture of a page, not a page. Nothing inside can be clicked,
          focused or read out: it would put a second "Add your photos" in the
          host's tab order, inside a form that saves. */}
      <div aria-hidden inert>
        <EventThemeRoot palette={palette} font={font}>
          <EventCover
            variant={cover}
            name={name}
            date={date}
            message={message}
            /* The one real photograph in the drawing - the host is judging
               their own picture in four different crops. The label is what
               fills the frame until they have picked one. */
            coverUrl={coverUrl ?? null}
            photoLabel={coverChosen ? "your photo" : "no photo yet"}
            palette={palette}
            preview
          />

          <main className="mx-auto max-w-3xl px-3 pb-4 pt-3 @sm:px-4 @sm:pb-5 @sm:pt-4">
            <UploadPanel
              variant={upload}
              label="Add your photos"
              hint={uploadHint}
              name=""
              preview
            />

            {galleryVisible && (
              <section className="mt-4 @sm:mt-5">
                <h2 className="text-body leading-tight">
                  Everyone&apos;s photos
                </h2>

                {/* One window, whatever is in it: the wall runs into a fade
                    the way it runs off the bottom of a phone, and every layout
                    is then judged in the same amount of room. It grows with
                    the drawing, so a wide one shows more rows rather than
                    bigger ones. */}
                <div className="relative mt-2 h-40 overflow-hidden @xs:h-48 @sm:h-52 @lg:h-60">
                  <PreviewGallery layout={layout} />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-butter to-transparent" />
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
 * The four walls, in miniature.
 *
 * Each one keeps the geometry its real counterpart in PhotoGallery has - equal
 * squares, ragged columns, the uneven circle sequence, one photo at a time -
 * because that geometry *is* the choice being made. Drawing all four as a row
 * of squares, which is what this used to do, made three of the four buttons
 * look broken.
 *
 * The column counts are a phone's, and they are counted off the width of the
 * drawing rather than the width of the screen: the drawing is about as wide as
 * a phone now, so the two agree by construction. Off the screen they did not -
 * a 320px drawing on a laptop was laying its photos out four across, which no
 * phone does, and the host was choosing between walls no guest would see.
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
    <div className="grid grid-cols-3 gap-1.5 @sm:grid-cols-4 @sm:gap-2">
      {Array.from({ length: 12 }).map((_, i) => (
        <PhotoPlaceholder key={i} className="aspect-square w-full" />
      ))}
    </div>
  );
}
