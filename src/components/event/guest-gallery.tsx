"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Lightbox } from "@/components/gallery/lightbox";
import { PhotoGallery } from "@/components/gallery/photo-gallery";
import { Button, Hole } from "@/components/ui";
import type { MediaView } from "@/lib/media-view";
import {
  type GalleryLayout,
  neighbours,
  withFreshHead,
  withOlder,
} from "@/lib/gallery";

/**
 * How often the wall may ask what is new. Slow enough that a guest sending
 * thirty photographs does not spend their rate limit refreshing.
 */
const REFRESH_EVERY_MS = 3000;

/**
 * How many empty frames stand in for a page on its way. Not the page size:
 * they promise that photographs are coming, not how many.
 */
const PENDING_TILES = 10;

/**
 * What everyone else has uploaded. On by default, but it is the host's switch,
 * and the layout is theirs too - there is no switcher on this page.
 */
export function GuestGallery({
  token,
  refreshKey,
  layout,
}: {
  token: string;
  refreshKey: number;
  /** The event's layout, set by the host. Guests do not change it. */
  layout: GalleryLayout;
}) {
  const [items, setItems] = useState<MediaView[]>([]);
  /**
   * Counted in the database, not the length of what is loaded - those agree
   * only up to the first page. Null until the first response.
   */
  const [total, setTotal] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * A page the guest asked for, rather than one the wall fetched itself. Only
   * the asked-for kind draws frames.
   */
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * An id rather than the photo itself: the lightbox has a position in the
   * wall, and holding the object would keep a deleted photo on screen.
   */
  const [openId, setOpenId] = useState<string | null>(null);
  /**
   * A refresh that did not land. The wall keeps what it has - a guest
   * mid-scroll must not have it emptied - but says so rather than going quiet.
   */
  const [staleSince, setStaleSince] = useState(false);
  /** Refreshes this component asks for itself, on top of the ones it is told about. */
  const [tick, setTick] = useState(0);

  /*
   * Readable from inside `load` without making `load` change identity on every
   * arrival, which would restart the effect below and double every refresh.
   */
  const shown = useRef<MediaView[]>([]);
  useEffect(() => {
    shown.current = items;
  }, [items]);

  const lastLoadAt = useRef(0);

  const load = useCallback(
    async (before: string | null, replace: boolean) => {
      setLoading(true);
      lastLoadAt.current = Date.now();
      try {
        const url = new URL("/api/gallery", window.location.origin);
        url.searchParams.set("token", token);
        if (before) url.searchParams.set("before", before);

        // The one request in the product that must never be answered from a
        // cache: it is asked again precisely because the answer has changed.
        const res = await fetch(url, { cache: "no-store" });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Could not load.");

        const page = body.items as MediaView[];
        const next = replace
          ? withFreshHead(shown.current, page)
          : withOlder(shown.current, page);

        setItems(next);
        setTotal(typeof body.total === "number" ? body.total : null);
        /*
         * The oldest photograph *held*, not the oldest in this response: a
         * refresh asks for the newest page while the guest may have scrolled
         * past several, and the head's cursor would refetch what they have.
         */
        setCursor(
          body.nextCursor ? (next[next.length - 1]?.createdAt ?? null) : null,
        );
        setError(null);
        setStaleSince(false);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Could not load the gallery.";
        if (shown.current.length > 0) setStaleSince(true);
        else setError(message);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  /**
   * Photographs land one at a time, so a literal refresh each would be thirty
   * requests a minute from one phone. A burst collapses into the next tick.
   */
  useEffect(() => {
    const wait =
      lastLoadAt.current === 0
        ? 0
        : Math.max(0, REFRESH_EVERY_MS - (Date.now() - lastLoadAt.current));
    const timer = setTimeout(() => load(null, true), wait);
    return () => clearTimeout(timer);
  }, [load, refreshKey, tick]);

  // The evening moved on while the guest was in the camera app.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const openIndex = openId ? items.findIndex((i) => i.id === openId) : -1;
  const open = openIndex === -1 ? null : items[openIndex];
  const step = open
    ? neighbours(
        items.map((i) => i.id),
        open.id,
      )
    : null;

  if (error && items.length === 0) {
    return (
      <section className="mt-10">
        <p className="text-[0.9375rem] text-ash">{error}</p>
      </section>
    );
  }

  return (
    <section className="mt-10 sm:mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[1.625rem] sm:text-h2">Everyone&apos;s photos</h2>
        {items.length > 0 && (
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
            {/* The count can lag the wall by one refresh, so the larger of
                the two is the honest one. */}
            {Math.max(total ?? 0, items.length)} so far
          </span>
        )}
      </div>

      {/* Not an error: what is on screen is real, just not the latest. A wall
          that quietly stopped updating looks like a failed upload. */}
      {staleSince && (
        <p className="mt-2 text-[0.9375rem] text-ash">
          Could not check for new photos.{" "}
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            className="underline underline-offset-2"
          >
            Try again
          </button>
        </p>
      )}

      {items.length === 0 && !loading ? (
        <div className="inset-shadow-well mt-6 rounded-[1.25rem] bg-ink/5 px-5 py-8 text-center sm:p-8">
          <div className="mx-auto flex w-fit gap-2">
            <Hole size={16} />
            <Hole size={24} />
            <Hole size={12} />
          </div>
          <p className="mt-5 text-lead">Nothing here yet.</p>
          <p className="mt-1 text-[0.9375rem] text-ash">
            Be the first - yours will appear right here.
          </p>
        </div>
      ) : (
        <PhotoGallery
          items={items}
          layout={layout}
          onActivate={(item) => setOpenId(item.id)}
          /* The first load draws the whole wall as frames rather than an
             empty container. */
          pending={
            loadingMore || (items.length === 0 && loading) ? PENDING_TILES : 0
          }
          className="mt-6"
        />
      )}

      {cursor && (
        <Button
          onClick={() => {
            // Set before the request: the frames are the answer to the tap,
            // so they appear with it rather than when the server replies.
            setLoadingMore(true);
            load(cursor, false).finally(() => setLoadingMore(false));
          }}
          variant="secondary"
          disabled={loading}
          className="mt-6 w-full"
        >
          {loading ? "Loading…" : "Show more"}
        </Button>
      )}

      {open && step && (
        <Lightbox
          token={token}
          item={open}
          prevId={step.prev}
          nextId={step.next}
          position={openIndex + 1}
          total={items.length}
          onStep={setOpenId}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  );
}
