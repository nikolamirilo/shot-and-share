import { EventCover, EventThemeRoot } from "@/components/event/EventCover";
import { UploadPanel } from "@/components/upload/UploadPanel";
import { PhotoPlaceholder } from "@/components/ui";
import type { Palette } from "@/lib/appearance/themes";
import type {
  CoverPosition,
  CoverVariant,
  UploadVariant,
} from "@/lib/appearance/variants";
import type { FontSet } from "@/lib/fonts";
import { type GalleryLayout } from "@/constants/gallery";
import { holeSize } from "@/utils/gallery";
import type { UploadWording } from "@/lib/media";

export interface EventPreviewProps {
  name: string;
  message?: string | null;
  palette: Palette;
  font: FontSet;
  cover: CoverVariant;
  coverPosition: CoverPosition;
  upload: UploadVariant;
  layout: GalleryLayout;
  wording: UploadWording;
  galleryVisible: boolean;
  coverChosen: boolean;
  coverUrl?: string | null;
}

export function EventPreview({
  name,
  message,
  palette,
  font,
  cover,
  coverPosition,
  upload,
  layout,
  wording,
  galleryVisible,
  coverChosen,
  coverUrl,
}: EventPreviewProps) {
  return (
    <div className="@container overflow-hidden rounded-xl shadow-md">
      <div aria-hidden inert>
        <EventThemeRoot palette={palette} font={font}>
          <EventCover
            variant={cover}
            name={name}
            message={message}
            coverUrl={coverUrl ?? null}
            photoLabel={coverChosen ? "your photo" : "no photo yet"}
            palette={palette}
            position={coverPosition}
            preview
          />

          <main className="mx-auto max-w-3xl px-3 pb-4 pt-3 @sm:px-4 @sm:pb-5 @sm:pt-4">
            <UploadPanel
              variant={upload}
              label={wording.action}
              captureLabel={wording.capture}
              chooseLabel={wording.choose}
              hint={wording.hint}
              preview
            />

            {galleryVisible && (
              <section className="mt-4 @sm:mt-5">
                <h2 className="text-body leading-tight">
                  Everyone&apos;s photos
                </h2>

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

const SKETCH_RATIOS = [1, 0.74, 1.34, 0.82, 1, 1.5, 0.72, 1.12, 0.9];

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
