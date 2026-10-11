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

import { ReportButton } from "@/components/gallery/ReportButton";
import {
  PICTURE_ATTR,
  SLIDE_GAP_PX,
  useSwipe,
} from "@/hooks/gallery/useSwipe";
import { GLASS, Photo, cx } from "@/components/ui";
import { type MediaView } from "@/types/media";

const VIEW_SIZES = "(max-width: 704px) 100vw, 672px";

const SAFE_AREA =
  "p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4";

const DOCK_ITEM =
  "inline-flex h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-full px-3.5 text-small font-semibold leading-none transition-colors hover:bg-scrim-ink/10 sm:px-4";

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
  prev: MediaView | null;
  next: MediaView | null;
  position: number;
  total: number;
  preload?: MediaView[];
  onStep: (id: string) => void;
  onClose: () => void;
  onReported?: (id: string) => void;
  favorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  demo?: boolean;
}) {
  const [full, setFull] = useState<MediaView | null>(null);
  const [linkPending, setLinkPending] = useState(true);
  const [ready, setReady] = useState<ReadonlySet<string>>(() => new Set());
  const markReady = (id: string) =>
    setReady((seen) => (seen.has(id) ? seen : new Set(seen).add(id)));
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
    let live = true;
    setFull(null);

    if (demo) {
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

  const videoUrl = item.kind === "video" ? full?.url : undefined;

  const ambient = item.previewUrl ?? item.posterUrl ?? item.fullUrl;

  const onScreen =
    item.kind === "video" ? Boolean(videoUrl) : ready.has(item.id);

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
       * `h-[100dvh]` rather than `inset-0` alone: on a phone `inset-0` is the *large*
       * viewport, so the foot of the sheet sits under Safari's toolbar.
       */
      className="fixed inset-0 z-50 h-[100dvh] overflow-hidden overscroll-contain bg-ink/92"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="absolute inset-0"
        style={{ touchAction: swipe.touchAction }}
        {...swipe.handlers}
      >
        {ambient && (
          <div
            aria-hidden
            className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl transition-[background-image] duration-300"
            style={{ backgroundImage: `url("${ambient}")` }}
          />
        )}
        <div aria-hidden className="absolute inset-0 bg-ink/72" />

        <div ref={track} className="absolute inset-0 will-change-transform">
          {slides.map(({ media, at }) => (
            <Slide
              key={media.id}
              item={media}
              at={at}
              videoUrl={at === 0 ? videoUrl : undefined}
              loaded={ready.has(media.id)}
              onLoad={() => markReady(media.id)}
              warm={at === 0 || onScreen || ready.has(media.id)}
            />
          ))}
        </div>

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
                  loading="eager"
                  fetchPriority="low"
                />
              ) : null;
            })}
          </div>
        )}
      </div>

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

      <div
        className={cx(
          "pointer-events-none absolute inset-0 z-20 flex flex-col justify-between",
          SAFE_AREA,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          {total > 1 ? (
            <span
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

          <div
            className={cx(
              "pointer-events-auto relative flex max-w-full items-center gap-1 rounded-full p-1.5",
              GLASS,
            )}
            onClick={(e) => e.stopPropagation()}
          >
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

function DockDivider() {
  return <span aria-hidden className="h-6 w-px shrink-0 bg-scrim-ink/15" />;
}

function Slide({
  item,
  at,
  videoUrl,
  loaded,
  onLoad,
  warm,
}: {
  item: MediaView;
  at: -1 | 0 | 1;
  videoUrl?: string;
  loaded: boolean;
  onLoad: () => void;
  warm: boolean;
}) {
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
        `h-full`, not `max-h-full`: a percentage height resolves against a
        parent that has one, so an auto-height frame leaves the picture
        unbounded and pushes the controls off the bottom of the screen.
      */}
      <div
        className={cx(
          "relative flex h-full w-full max-w-2xl items-center justify-center",
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
            className="max-h-full max-w-full rounded-md"
          />
        ) : (
          <>
            {!(still && loaded) && (
              <div
                {...picture}
                onClick={stop}
                className={cx(
                  "shimmer overflow-hidden rounded-md bg-well",
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
                width={item.width ?? 1200}
                height={item.height ?? 900}
                sizes={VIEW_SIZES}
                unoptimized={item.kind === "video" || undefined}
                onLoad={onLoad}
                onClick={stop}
                {...(at === 0
                  ? { priority: true }
                  : { loading: "eager" as const, fetchPriority: "low" as const })}
                className="relative h-auto max-h-full w-auto max-w-full rounded-md shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

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
      onClick={(e) => {
        e.stopPropagation();
        if (targetId) onStep(targetId);
      }}
      aria-label={back ? "Previous photo" : "Next photo"}
      className={cx(
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
