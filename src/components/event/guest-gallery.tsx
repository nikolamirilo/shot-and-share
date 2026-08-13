"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Lightbox } from "@/components/gallery/lightbox";
import { PhotoGallery } from "@/components/gallery/photo-gallery";
import { Button, Hole } from "@/components/ui";
import { getFingerprint } from "@/lib/client/upload";
import type { MediaView } from "@/lib/media-view";
import {
  type GalleryLayout,
  neighbours,
  withFreshHead,
  withOlder,
} from "@/lib/gallery";

/**
 * How often the wall may ask the server what is new, at most.
 *
 * Slow enough that a guest sending thirty photographs does not spend their rate
 * limit refreshing, fast enough that a photograph appears while they are still
 * looking at the page rather than after the batch finally finishes.
 */
const REFRESH_EVERY_MS = 3000;

/**
 * What everyone else has uploaded. Guests genuinely like seeing the night from
 * other people's phones, which is why this is on by default - but it is the
 * host's switch, and when they turn it off the page is upload-only.
 *
 * The layout is the host's, and only the host's. A guest gets the wall the host
 * designed, the same way they get the theme and the cover; there is no switcher
 * on this page.
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
   * Every photograph at the event, counted in the database - not the length of
   * what has been loaded. Those two are the same number only until a guest
   * reaches fifty, and after that the heading was telling a wedding with four
   * hundred photographs in it that there were fifty. Null until the first
   * response, and if the count itself fails the length is a fair stand-in.
   */
  const [total, setTotal] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * Which photo is open, held as an id rather than the photo itself. The
   * lightbox now has a position in the wall - arrows either side - and a
   * position only means something against the list. Holding the object would
   * also keep a deleted photo on screen after it left `items`.
   */
  const [openId, setOpenId] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState("");
  /**
   * A refresh that did not land. The wall keeps whatever it already has - a
   * guest mid-scroll must not have it emptied under them - but silence was the
   * wrong other half of that: photographs went up, the refresh failed, the wall
   * did not change, and nothing anywhere said so.
   */
  const [staleSince, setStaleSince] = useState(false);
  /** Refreshes this component asks for itself, on top of the ones it is told about. */
  const [tick, setTick] = useState(0);

  useEffect(() => setFingerprint(getFingerprint()), []);

  /*
   * What is on screen, readable from inside `load` without making `load` change
   * identity every time a photograph arrives - which would restart the effect
   * below and turn every refresh into a second refresh.
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
         * The cursor is the oldest photograph *held*, not the oldest in this
         * response. A refresh asks for the newest fifty while the guest may
         * already have scrolled through two hundred; handing back the head's
         * cursor would make "Show more" fetch pages they are already looking
         * at, and the button would appear to do nothing.
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
   * Photographs land one at a time, so the wall is told to refresh one at a
   * time. Doing that literally would be a request per photograph - thirty in a
   * minute from one phone, which is most of a guest's rate limit spent watching
   * their own upload. Instead the wall refreshes at most every few seconds, and
   * a burst of arrivals collapses into the next one of those.
   */
  useEffect(() => {
    const wait =
      lastLoadAt.current === 0
        ? 0
        : Math.max(0, REFRESH_EVERY_MS - (Date.now() - lastLoadAt.current));
    const timer = setTimeout(() => load(null, true), wait);
    return () => clearTimeout(timer);
  }, [load, refreshKey, tick]);

  /*
   * A guest leaves the page to take another photograph and comes back. The
   * evening moved on while they were in the camera app, and coming back to a
   * wall frozen at the moment they left is the same complaint as not refreshing
   * after an upload.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  async function removeOwn(item: MediaView) {
    if (!confirm("Remove this photo?")) return;
    const res = await fetch("/api/guest/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, fingerprint, mediaId: item.id }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body?.error?.message ?? "Could not remove it.");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setOpenId(null);
  }

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
            {/* The count can lag the wall by one refresh - a photograph that
                has just landed is in the page and not yet in the number - so
                the larger of the two is the honest one. */}
            {Math.max(total ?? 0, items.length)} so far
          </span>
        )}
      </div>

      {/* Not an error - what is on screen is real, it is just not the latest.
          Said out loud, because a wall that quietly stopped updating is
          indistinguishable from an upload that quietly failed. */}
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
          className="mt-6"
        />
      )}

      {cursor && (
        <Button
          onClick={() => load(cursor, false)}
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
          mine={open.uploaderFingerprint === fingerprint}
          prevId={step.prev}
          nextId={step.next}
          position={openIndex + 1}
          total={items.length}
          onStep={setOpenId}
          onClose={() => setOpenId(null)}
          onRemove={() => removeOwn(open)}
        />
      )}
    </section>
  );
}
