"use client";

import { useCallback, useEffect, useState } from "react";

import { Lightbox } from "@/components/gallery/lightbox";
import { PhotoGallery } from "@/components/gallery/photo-gallery";
import { Button, Hole } from "@/components/ui";
import { getFingerprint } from "@/lib/client/upload";
import type { MediaView } from "@/lib/media-view";
import { type GalleryLayout, neighbours } from "@/lib/gallery";

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

  useEffect(() => setFingerprint(getFingerprint()), []);

  const load = useCallback(
    async (before: string | null, replace: boolean) => {
      setLoading(true);
      try {
        const url = new URL("/api/gallery", window.location.origin);
        url.searchParams.set("token", token);
        if (before) url.searchParams.set("before", before);

        const res = await fetch(url);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Could not load.");

        setItems((prev) => (replace ? body.items : [...prev, ...body.items]));
        setCursor(body.nextCursor);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load the gallery.");
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    load(null, true);
  }, [load, refreshKey]);

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
        <p className="text-[0.9375rem] text-crust">{error}</p>
      </section>
    );
  }

  return (
    <section className="mt-10 sm:mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[1.625rem] sm:text-h2">Everyone&apos;s photos</h2>
        {items.length > 0 && (
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
            {items.length} so far
          </span>
        )}
      </div>

      {items.length === 0 && !loading ? (
        <div className="inset-shadow-well mt-6 rounded-[1.25rem] bg-pepper/5 px-5 py-8 text-center sm:p-8">
          <div className="mx-auto flex w-fit gap-2">
            <Hole size={16} />
            <Hole size={24} />
            <Hole size={12} />
          </div>
          <p className="mt-5 text-lead">Nothing here yet.</p>
          <p className="mt-1 text-[0.9375rem] text-crust">
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
