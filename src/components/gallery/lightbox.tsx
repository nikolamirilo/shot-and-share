"use client";

import { useEffect, useRef, useState } from "react";
import {
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdFavorite,
  MdFavoriteBorder,
  MdOutlineFileDownload,
} from "react-icons/md";

import { ReportButton } from "@/components/gallery/report-button";
import {
  PICTURE_ATTR,
  SLIDE_GAP_PX,
  useSwipe,
} from "@/components/gallery/use-swipe";
import { GLASS, Photo, cx } from "@/components/ui";
import type { MediaView } from "@/lib/media-view";

/**
 * How wide the picture is going to be: full width on a phone, and the frame is
 * `max-w-2xl` after that.
 *
 * One constant because the photographs fetched ahead have to ask for exactly
 * what the one on screen will ask for. The browser picks a copy out of the
 * srcset using this, so a different value here is a different URL, and a
 * different URL is a fetch that warms nothing.
 */
const VIEW_SIZES = "(max-width: 704px) 100vw, 672px";

/**
 * The notch at the top, the home indicator at the bottom, the rounded corners
 * in landscape. Shared because the picture and the controls are two separate
 * layers over the same window and have to agree on where its edges are.
 */
const SAFE_AREA =
  "p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4";

/**
 * One command in the dock.
 *
 * A fixed height and a minimum width, so a command is the same shape whether
 * its label is showing or not, and the pill around them cannot change size
 * when one of them changes state. That is the bug this layout exists to fix:
 * the old row was centred and wrapped, so "Add to favourites" becoming
 * "Favourite" moved every other button sideways.
 */
const DOCK_ITEM =
  "inline-flex h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-full px-3.5 text-small font-semibold leading-none transition-colors hover:bg-scrim-ink/10 sm:px-4";

/**
 * The word beside the icon. Hidden on a phone, where four labels do not fit
 * across a pill - but `sr-only` rather than `hidden`, because a button with
 * its label set to `display: none` has no name for a screen reader to read.
 */
const DOCK_LABEL = "sr-only sm:not-sr-only";

export function Lightbox({
  token,
  item,
  prev,
  next,
  position,
  total,
  preload = [],
  onStep,
  onClose,
  onReported,
  favorite,
  onToggleFavorite,
  demo,
}: {
  token: string;
  item: MediaView;
  /**
   * The photo on each side, or null at either end of what has loaded. Whole
   * items rather than ids, because they are on the strip beside this one,
   * ready to be dragged in.
   */
  prev: MediaView | null;
  next: MediaView | null;
  /** Which of the loaded photos this is, counting from one. */
  position: number;
  total: number;
  /**
   * The photographs after this one, in order, fetched in the background so
   * that stepping forward shows a picture rather than a shimmer.
   *
   * The full-size copies are resized by the optimiser on first request, which
   * is the couple of seconds a guest spends looking at an empty frame. Asking
   * for them early moves that wait under the photograph they are already
   * looking at. Empty is fine - it just means nothing is warmed.
   */
  preload?: MediaView[];
  onStep: (id: string) => void;
  onClose: () => void;
  /**
   * A guest reported this one. The wall drops it and closes behind itself, so
   * the photograph is gone from the screen of the person who objected to it
   * rather than sitting there until the next refresh.
   */
  onReported?: (id: string) => void;
  /** Whether this one is in the guest's favourites. */
  favorite?: boolean;
  /** Present on the guest wall only: the heart in the dock. */
  onToggleFavorite?: (id: string) => void;
  /**
   * The demo gallery, whose photographs are files in `public` rather than rows
   * in a bucket. There is no signed URL to go and fetch, so the request is
   * skipped rather than fired and allowed to fail.
   */
  demo?: boolean;
}) {
  const [full, setFull] = useState<MediaView | null>(null);
  /**
   * True while the download link is being fetched. Separate from `full` being
   * empty, which after the request means the link is not coming at all.
   */
  const [linkPending, setLinkPending] = useState(true);
  /**
   * The photographs whose pixels have arrived, this one or either side of it.
   * A set rather than one flag, because the next photo usually lands while it
   * is still beside this one - and when it slides in, it is already there.
   */
  const [ready, setReady] = useState<ReadonlySet<string>>(() => new Set());
  const markReady = (id: string) =>
    setReady((seen) => (seen.has(id) ? seen : new Set(seen).add(id)));
  /** The report sheet is open, which is the one time the arrows are in the way. */
  const [reporting, setReporting] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const swipe = useSwipe({
    track,
    prevId: prev?.id ?? null,
    nextId: next?.id ?? null,
    onStep,
    disabled: reporting,
  });
  const { step } = swipe;

  useEffect(() => {
    setReporting(false);
  }, [item.id]);

  useEffect(() => {
    /*
     * Full-resolution URLs resolve only now, never for a whole page.
     *
     * Clearing first matters: `full` is where Download gets its link, so
     * carrying the old one across a step would offer the previous photo under
     * this one's picture. `live` covers the same hazard from the other side -
     * step twice quickly and the requests can land out of order.
     */
    let live = true;
    setFull(null);

    if (demo) {
      // The file is already the full copy, and it is public.
      setFull({ ...item, downloadUrl: item.fullUrl ?? undefined });
      setLinkPending(false);
      return;
    }

    setLinkPending(true);
    const params = new URLSearchParams({ token, id: item.id });
    fetch(`/api/photo?${params}`)
      .then((r) => r.json())
      .then((data) => live && setFull(data?.id ? data : null))
      .catch(() => live && setFull(null))
      .finally(() => live && setLinkPending(false));
    return () => {
      live = false;
    };
  }, [token, item, demo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && prev) step(prev.id);
      if (e.key === "ArrowRight" && next) step(next.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step, prev, next]);

  /** A video plays from the signed URL, which only the one on screen asks for. */
  const videoUrl = item.kind === "video" ? full?.url : undefined;

  /*
   * What the backdrop is made of: this photograph again, blown up, blurred and
   * dimmed. The thumbnail rather than the full copy - it is about to be thrown
   * out of focus, and the wall has already fetched it, so it costs nothing and
   * is there before the big one lands.
   */
  const ambient = item.previewUrl ?? item.posterUrl ?? item.fullUrl;

  /*
   * This photograph is up, so the connection is free for the next ones. Waiting
   * on it rather than firing everything at once is the same bargain the wall
   * makes in `useLoadQueue`: on a venue's wifi, six requests at once means the
   * picture somebody is actually waiting for arrives sixth.
   *
   * A clip counts as up once its URL resolves - it streams as it plays and is
   * never going to report itself finished.
   */
  const onScreen =
    item.kind === "video" ? Boolean(videoUrl) : ready.has(item.id);

  /*
   * The strip: this photograph, with the one on each side waiting just off
   * the screen. Keyed by id, so after a turn the photo that slid in is the same
   * element, already decoded, rather than a new one starting from nothing.
   */
  const slides = [
    { media: prev, at: -1 as const },
    { media: item, at: 0 as const },
    { media: next, at: 1 as const },
  ].filter((slide): slide is { media: MediaView; at: -1 | 0 | 1 } =>
    Boolean(slide.media),
  );

  return (
    <div
      /*
       * `h-[100dvh]` rather than `inset-0` alone. On a phone `inset-0` is the
       * *large* viewport - the window as it would be with the browser's own
       * bars hidden - so the bottom of this sheet spent its life underneath
       * Safari's toolbar, taking whatever was down there with it. The dynamic
       * unit is the window as it actually is right now.
       */
      className="fixed inset-0 z-50 h-[100dvh] overflow-hidden overscroll-contain bg-ink/92"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/*
       * The photograph's own colours behind everything, out of focus.
       *
       * It is what makes the controls read as glass rather than as grey
       * plastic: a see-through thing needs something behind it worth seeing.
       * Scaled up because a blur that size pulls the edges of the picture
       * inwards and would otherwise leave a soft border all the way round.
       */}
      {/*
       * The stage: everything under the controls, and the surface a finger
       * drags. The controls are a separate layer on top, so a touch on one of
       * them never reaches it, and a swipe never starts on a button.
       */}
      <div
        className="absolute inset-0"
        style={{ touchAction: swipe.touchAction }}
        {...swipe.handlers}
      >
        {/*
         * The photograph's own colours behind everything, out of focus.
         *
         * It is what makes the controls read as glass rather than as grey
         * plastic: a see-through thing needs something behind it worth seeing.
         * Scaled up because a blur that size pulls the edges of the picture
         * inwards and would otherwise leave a soft border all the way round.
         * Cross-faded on a step where the browser can, so the light behind the
         * photo changes with it rather than in one hard cut.
         */}
        {ambient && (
          <div
            aria-hidden
            className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl transition-[background-image] duration-300"
            style={{ backgroundImage: `url("${ambient}")` }}
          />
        )}
        {/* And the dark over it, so the picture in the middle is still the
            brightest thing on the screen. */}
        <div aria-hidden className="absolute inset-0 bg-ink/72" />

        {/* The strip itself, the width of the window, moved by `useSwipe`. */}
        <div ref={track} className="absolute inset-0 will-change-transform">
          {slides.map(({ media, at }) => (
            <Slide
              key={media.id}
              item={media}
              at={at}
              videoUrl={at === 0 ? videoUrl : undefined}
              loaded={ready.has(media.id)}
              onLoad={() => markReady(media.id)}
              /* The ones either side wait for this one, like everything
                 fetched ahead - unless they are already here. */
              warm={at === 0 || onScreen || ready.has(media.id)}
            />
          ))}
        </div>

        {/*
         * The photographs after this one, off-screen and at low priority.
         *
         * Real <Photo> elements rather than a hand-built preload link: they
         * carry the same `sizes`, the same dimensions and the same fallback
         * to an unoptimised copy, so the browser resolves the same URL it
         * will want when the guest steps - and finds it already in the cache.
         * The very next one is on the strip already, so it is not asked for
         * twice.
         *
         * Clipped to nothing rather than `display: none`, which browsers are
         * entitled to treat as a reason not to fetch at all.
         */}
        {onScreen && preload.length > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
          >
            {preload.map((ahead) => {
              const src = ahead.fullUrl ?? ahead.previewUrl;
              return src && ahead.id !== next?.id ? (
                <Photo
                  key={ahead.id}
                  src={src}
                  alt=""
                  width={ahead.width ?? 1200}
                  height={ahead.height ?? 900}
                  sizes={VIEW_SIZES}
                  // Eager, or an image nowhere near the viewport is never
                  // fetched at all - but behind everything the page still
                  // wants, this photograph included.
                  loading="eager"
                  fetchPriority="low"
                />
              ) : null;
            })}
          </div>
        )}
      </div>

      {/*
       * The arrows, in a frame the same shape as the picture's but standing
       * still while the strip moves underneath.
       *
       * Beside the picture rather than at the edge of the window, which on a
       * wide screen is a long way from anything. Nothing to step to means one
       * photo in the event, where two dead buttons would be furniture; and
       * they go while the report sheet is open, because a guest choosing a
       * reason should not be one mis-tap away from a different photograph.
       */}
      {(prev || next) && !reporting && (
        <div
          className={cx(
            "pointer-events-none absolute inset-0 z-10 flex items-center justify-center",
            SAFE_AREA,
          )}
        >
          <div className="relative h-full w-full max-w-2xl">
            <StepArrow direction="prev" targetId={prev?.id ?? null} onStep={step} />
            <StepArrow direction="next" targetId={next?.id ?? null} onStep={step} />
          </div>
        </div>
      )}

      {/*
       * The controls, on their own layer over the window rather than inside
       * the frame. Pinned to the window and not to the picture, which is the
       * point: a tall photograph and a wide one now give the same screen, and
       * nothing down here moves when the one above it changes shape.
       *
       * The layer itself takes no clicks - a tap beside the photograph still
       * closes, and a swipe still steps - so each control turns them back on
       * for itself.
       */}
      <div
        className={cx(
          "pointer-events-none absolute inset-0 z-20 flex flex-col justify-between",
          SAFE_AREA,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          {total > 1 ? (
            <span
              /* Quiet by being 11px mono and widely tracked, rather than by
                 being a faded ink: faded ink on thin glass over a dark
                 photograph is the one combination that does not clear AA. */
              className={cx(
                "rounded-full px-3.5 py-2 font-mono text-micro uppercase tracking-[0.16em]",
                GLASS,
              )}
            >
              {position} of {total}
            </span>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className={cx(
              "pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform hover:scale-105",
              GLASS,
            )}
          >
            <MdClose aria-hidden className="h-6 w-6" />
          </button>
        </div>

        <div className="flex min-h-0 flex-col items-center gap-2.5">
          {item.processing && (
            <p
              className={cx(
                "max-w-sm rounded-2xl px-3.5 py-2 text-center text-label",
                GLASS,
              )}
            >
              Still being converted so it plays everywhere. Check back shortly.
            </p>
          )}

          {/*
           * The dock: one pill holding every command, centred on the window.
           *
           * One shape rather than a row of separate buttons, and that is what
           * the old layer got wrong - a white pill beside a see-through arrow
           * beside a dark counter looked like three different interfaces
           * fighting for the same strip of screen.
           *
           * `relative` because the report sheet opens upwards out of it.
           */}
          <div
            className={cx(
              "pointer-events-auto relative flex max-w-full items-center gap-1 rounded-full p-1.5",
              GLASS,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* One anchor in two states rather than one that appears when the
                link lands: stepping re-fetches, and a button that vanishes and
                returns moves the one beside it every time. Absent entirely
                once the request finishes with no link, since there is nothing
                left to wait for. */}
            {(linkPending || full?.downloadUrl) && (
              <a
                href={full?.downloadUrl}
                download={full?.downloadUrl ? true : undefined}
                aria-disabled={full?.downloadUrl ? undefined : true}
                className={cx(DOCK_ITEM, !full?.downloadUrl && "opacity-45")}
              >
                <MdOutlineFileDownload
                  aria-hidden
                  className="shrink-0 text-[1.25em]"
                />
                <span className={DOCK_LABEL}>Download</span>
              </a>
            )}

            {onToggleFavorite && (
              <>
                <DockDivider />
                <button
                  type="button"
                  onClick={() => onToggleFavorite(item.id)}
                  aria-pressed={favorite ? true : false}
                  className={DOCK_ITEM}
                >
                  {/* The heart fills in; the word stays put. A label that
                      changed with the state would change the width of the
                      pill, and the pill is centred. */}
                  {favorite ? (
                    <MdFavorite aria-hidden className="shrink-0 text-[1.25em]" />
                  ) : (
                    <MdFavoriteBorder
                      aria-hidden
                      className="shrink-0 text-[1.25em]"
                    />
                  )}
                  <span className={DOCK_LABEL}>Favourite</span>
                </button>
              </>
            )}

            {onReported && (
              <>
                <DockDivider />
                <ReportButton
                  token={token}
                  mediaId={item.id}
                  className={DOCK_ITEM}
                  labelClassName={DOCK_LABEL}
                  onReported={() => onReported(item.id)}
                  onOpenChange={setReporting}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The hairline between two commands in the dock. */
function DockDivider() {
  return <span aria-hidden className="h-6 w-px shrink-0 bg-scrim-ink/15" />;
}

/**
 * One photograph on the strip: the one on screen, or one either side of it
 * waiting to be dragged in.
 */
function Slide({
  item,
  at,
  videoUrl,
  loaded,
  onLoad,
  warm,
}: {
  item: MediaView;
  /** Left of the screen, on it, or right of it. */
  at: -1 | 0 | 1;
  /** Only for the clip on screen: the others show their poster. */
  videoUrl?: string;
  /** Its pixels have arrived, so the shimmer can go. */
  loaded: boolean;
  onLoad: () => void;
  /** Whether its picture may be fetched yet. */
  warm: boolean;
}) {
  /*
   * What to show when it is not a playing clip. A photo shows the full copy
   * through the optimiser, falling back to whatever the grid had if there is
   * not one. A clip shows its poster until its URL arrives, so one dragged in
   * from the side looks the same before and after it lands.
   */
  const still =
    item.kind === "video"
      ? (item.previewUrl ?? item.posterUrl)
      : (item.fullUrl ?? item.previewUrl);
  const picture = { [PICTURE_ATTR]: "" };
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      aria-hidden={at === 0 ? undefined : true}
      className={cx(
        "absolute inset-0 flex items-center justify-center",
        SAFE_AREA,
      )}
      style={
        at === 0
          ? undefined
          : {
              transform: `translate3d(calc(${at * 100}% + ${at * SLIDE_GAP_PX}px), 0, 0)`,
            }
      }
    >
      {/*
       * The frame. `h-full` and not `max-h-full`, which is the whole reason
       * the controls used to disappear: a percentage height resolves against
       * a parent that has one, and `max-h-full` leaves this box auto-height,
       * so `max-h-full` on the picture inside it resolved to nothing at all.
       * A portrait photo then rendered at its full height, overflowed the
       * window, and pushed every button out of the bottom of the screen.
       * With a real height here, the picture is bounded by the frame and the
       * frame is bounded by the window.
       */}
      <div
        className={cx(
          "relative flex h-full w-full max-w-2xl items-center justify-center",
          /* A clip keeps its own controls along its bottom edge, and the
             dock floats over that strip. The picture moves rather than the
             dock: everything on the glass stays where it was put. */
          item.kind === "video" && "pb-24",
        )}
      >
        {videoUrl ? (
          <video
            src={videoUrl}
            poster={item.posterUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            onClick={stop}
            className="max-h-full max-w-full rounded-xl"
          />
        ) : (
          /*
           * Through the optimiser rather than a bare <img>: `fullUrl` is the
           * full-size copy, a couple of megabytes to fill 672 pixels.
           *
           * The shimmer sits *under* the image and the image is never faded
           * in, so if `onLoad` never fires the photo still shows.
           */
          <>
            {!(still && loaded) && (
              <div
                {...picture}
                onClick={stop}
                className={cx(
                  "shimmer overflow-hidden rounded-xl bg-well",
                  still
                    ? "absolute inset-0"
                    : item.kind === "video"
                      ? "aspect-video w-full"
                      : "aspect-square w-full",
                )}
              />
            )}
            {still && warm && (
              <Photo
                {...picture}
                src={still}
                alt=""
                // A 4:3 guess when we have no real dimensions: it only holds
                // the shimmer's shape until the photo takes over.
                width={item.width ?? 1200}
                height={item.height ?? 900}
                sizes={VIEW_SIZES}
                // A poster is a small stored frame, already the right size.
                unoptimized={item.kind === "video" || undefined}
                onLoad={onLoad}
                onClick={stop}
                // The one on screen is the point of the screen, so never
                // lazy. The ones beside it are eager too, or a picture off
                // the edge is never fetched - but behind everything else.
                {...(at === 0
                  ? { priority: true }
                  : { loading: "eager" as const, fetchPriority: "low" as const })}
                /* Bounded both ways, and `w-auto`/`h-auto` so the aspect ratio
                   survives the bounding: whichever edge runs out first is the
                   one that holds the photograph. */
                className="relative h-auto max-h-full w-auto max-w-full rounded-xl shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * One of the two arrows. A null target is the end of what has loaded: the
 * button stays put and greys out, because one that disappeared would move the
 * other and shift the photo underneath.
 *
 * On a touch screen they step aside: the photo itself is the control there,
 * swiped or tapped on either half. Still in the page for a screen reader,
 * which cannot swipe a picture, so `sr-only` rather than `hidden`.
 */
function StepArrow({
  direction,
  targetId,
  onStep,
}: {
  direction: "prev" | "next";
  targetId: string | null;
  onStep: (id: string) => void;
}) {
  const back = direction === "prev";
  return (
    <button
      type="button"
      disabled={!targetId}
      /* The backdrop closes on click and this button sits on top of it, so the
         step has to stop where it happened or every step is also a close. */
      onClick={(e) => {
        e.stopPropagation();
        if (targetId) onStep(targetId);
      }}
      aria-label={back ? "Previous photo" : "Next photo"}
      className={cx(
        /*
         * A plain half. It used to be `min(50%, 35vh)`, because a portrait
         * photo laid out at full width ran off the bottom of the screen and
         * took its own middle with it. The picture is bounded by the window
         * now, so half of it is always somewhere a thumb can reach.
         */
        "pointer-events-auto absolute top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full transition-transform hover:scale-105 disabled:pointer-events-none disabled:opacity-45 pointer-coarse:sr-only",
        GLASS,
        back ? "left-2" : "right-2",
      )}
    >
      {back ? (
        <MdChevronLeft aria-hidden className="h-7 w-7" />
      ) : (
        <MdChevronRight aria-hidden className="h-7 w-7" />
      )}
    </button>
  );
}
