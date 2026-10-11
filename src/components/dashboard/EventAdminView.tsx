import { MdOutlineOpenInNew, MdOutlineSlideshow } from "react-icons/md";

import { HostGallery } from "@/components/dashboard/HostGallery";
import { ReviewPanel } from "@/components/dashboard/ReviewPanel";
import { EventCover, EventThemeRoot } from "@/components/event/EventCover";
import { Alert, ButtonLink } from "@/components/ui";
import type { Appearance } from "@/lib/appearance";
import { type EventRow } from "@/types/db";
import { googleFontsHref } from "@/lib/fonts";
import { type MediaView } from "@/types/media";
import { formatCount } from "@/utils/format";

export function EventAdminView({
  event,
  appearance,
  media,
  review,
  photoCount,
  shareLink,
  coverUrl,
  coverPreviewUrl,
  slideshow,
}: {
  event: EventRow;
  appearance: Appearance;
  media: MediaView[];
  review: MediaView[];
  photoCount: number;
  shareLink: string | null;
  coverUrl: string | null;
  coverPreviewUrl: string | null;
  slideshow: boolean;
}) {
  const fontsHref = googleFontsHref(appearance.font);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {shareLink && (
          <ButtonLink
            href={shareLink}
            target="_blank"
            rel="noreferrer"
            variant="secondary"
            size="sm"
          >
            <MdOutlineOpenInNew aria-hidden className="shrink-0" />
            Open the guest page
          </ButtonLink>
        )}
        {slideshow && (
          <ButtonLink
            href={`/dashboard/events/${event.id}/slideshow`}
            variant="secondary"
            size="sm"
          >
            <MdOutlineSlideshow aria-hidden className="shrink-0" />
            Open the live slideshow
          </ButtonLink>
        )}
      </div>

      {review.length > 0 && (
        <div className="mt-4">
          <ReviewPanel eventId={event.id} items={review} />
        </div>
      )}

      {!event.gallery_visible && (
        <Alert tone="notice" className="mt-4">
          <strong>The gallery is turned off.</strong> Guests see the upload box
          and nothing else. You can still see and delete everything below, and
          turn it back on under Edit.
        </Alert>
      )}

      <div className="mt-5 overflow-hidden rounded-[1.25rem] shadow-md sm:mt-6">
        <EventThemeRoot palette={appearance.palette} font={appearance.font}>
          {fontsHref && (
            <link rel="stylesheet" href={fontsHref} precedence="default" />
          )}

          <EventCover
            variant={appearance.cover}
            name={event.name}
            message={event.welcome_message}
            coverUrl={coverUrl}
            coverPreviewUrl={coverPreviewUrl}
            palette={appearance.palette}
            position={appearance.coverPosition}
            embedded
          />

          <main className="mx-auto max-w-3xl px-4 pb-10 pt-6 sm:px-5 sm:pb-12 sm:pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="text-[1.625rem] sm:text-h2">
                Everyone&apos;s photos
              </h2>
              {photoCount > 0 && (
                <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
                  {formatCount(photoCount)} so far
                </span>
              )}
            </div>

            {media.length < photoCount && (
              <p className="mt-2 text-[0.8125rem] text-ash">
                Showing the {media.length} most recent of {photoCount}.
              </p>
            )}

            <div className="mt-6">
              <HostGallery
                eventId={event.id}
                media={media}
                shareLink={shareLink}
                layout={appearance.layout}
              />
            </div>
          </main>
        </EventThemeRoot>
      </div>
    </div>
  );
}
