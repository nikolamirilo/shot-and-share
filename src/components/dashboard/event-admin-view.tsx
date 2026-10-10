import { MdOutlineOpenInNew, MdOutlineSlideshow } from "react-icons/md";

import { HostGallery } from "@/components/dashboard/host-gallery";
import { ReviewPanel } from "@/components/dashboard/review-panel";
import { EventCover, EventThemeRoot } from "@/components/event/event-cover";
import { Alert, ButtonLink } from "@/components/ui";
import type { Appearance } from "@/lib/appearance";
import type { EventRow } from "@/lib/db/types";
import { googleFontsHref } from "@/lib/fonts";
import type { MediaView } from "@/lib/media-view";

/**
 * The event itself, from the host's side of it.
 *
 * The same cover, the same colours, the same type and the same wall a guest
 * gets - the real components under the real EventThemeRoot, so what the host
 * looks at here is the page rather than a drawing of it. On top of that, the
 * two things only a host can do: clear whatever is waiting on them, and take
 * photographs down.
 *
 * Nothing on this tab changes the event. Every setting lives under Edit, which
 * is why the gallery has no layout switcher: a host judging their own page
 * needs this wall laid out the way their guests will see it.
 */
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
  /** The newest uploads, already loaded by the console. */
  media: MediaView[];
  /** Held, flagged or reported uploads. Usually empty. */
  review: MediaView[];
  /** Every upload at the event, not only the loaded ones. */
  photoCount: number;
  /** Null when the host has revoked every link. */
  shareLink: string | null;
  coverUrl: string | null;
  coverPreviewUrl: string | null;
  /** Whether this plan has the live slideshow. */
  slideshow: boolean;
}) {
  // Only the pairing this event uses, for the same reason the guest page loads
  // one: eight font families to render one of them is a slow page.
  const fontsHref = googleFontsHref(appearance.font);

  return (
    <div>
      {/* Above the page rather than inside it, and in the dashboard's own
          colours: this is the host's business, not part of what guests see. */}
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

      {/* Anything waiting on the host is the one thing here that will not
          resolve itself, so it sits above the page. Draws nothing when the
          queue is empty, which is nearly always. */}
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

      {/* The page, framed. The frame is the only thing on this tab a guest
          would not recognise. */}
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
              {/* The guest page's own heading, word for word. */}
              <h2 className="text-[1.625rem] sm:text-h2">
                Everyone&apos;s photos
              </h2>
              {photoCount > 0 && (
                <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
                  {photoCount.toLocaleString("en-GB")} so far
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
