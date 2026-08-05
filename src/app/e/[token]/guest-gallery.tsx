"use client";

import { useCallback, useEffect, useState } from "react";

import { LayoutSwitcher, PhotoGallery } from "@/components/gallery";
import { Button, Hole } from "@/components/ui";
import { getFingerprint } from "@/lib/client/upload";
import type { MediaView } from "@/lib/events";
import {
  type GalleryLayout,
  readViewerLayout,
  writeViewerLayout,
} from "@/lib/gallery";

/**
 * What everyone else has uploaded. Guests genuinely like seeing the night from
 * other people's phones, which is why this is on by default - but it is the
 * host's switch, and when they turn it off the page is upload-only.
 *
 * The host chooses which layout a guest lands on. The guest can then change it
 * for themselves, and that sticks across events, because how somebody likes to
 * look at photos is a fact about them rather than about the wedding.
 */
export function GuestGallery({
  token,
  refreshKey,
  eventLayout,
  allowLayoutChoice,
}: {
  token: string;
  refreshKey: number;
  eventLayout: GalleryLayout;
  /** Free events fix the layout, so there is nothing to switch. */
  allowLayoutChoice: boolean;
}) {
  const [items, setItems] = useState<MediaView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<MediaView | null>(null);
  const [fingerprint, setFingerprint] = useState("");
  const [layout, setLayout] = useState<GalleryLayout>(eventLayout);

  useEffect(() => setFingerprint(getFingerprint()), []);

  // Server-rendered markup has to match the host's default on first paint;
  // the viewer's own preference is only knowable once we are in the browser.
  useEffect(() => {
    if (!allowLayoutChoice) return;
    const preferred = readViewerLayout();
    if (preferred) setLayout(preferred);
  }, [allowLayoutChoice]);

  function chooseLayout(next: GalleryLayout) {
    setLayout(next);
    writeViewerLayout(next);
  }

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
    setOpen(null);
  }

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
        <div className="mt-6 rounded-[1.25rem] border-2 border-dashed border-rind px-5 py-8 text-center sm:p-8">
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
        <>
          {/* Only worth offering once there is enough on screen for the choice
              to make any visible difference. */}
          {allowLayoutChoice && items.length >= 4 && (
            /* The switcher is wider than the smallest phone. It scrolls to the
               screen edge rather than being squashed, and starts at the right
               where it sits on every larger screen. */
            <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <div className="flex min-w-max justify-end">
                <LayoutSwitcher value={layout} onChange={chooseLayout} />
              </div>
            </div>
          )}

          <PhotoGallery
            items={items}
            layout={layout}
            onActivate={setOpen}
            className="mt-4"
          />
        </>
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

      {open && (
        <Lightbox
          token={token}
          item={open}
          mine={open.uploaderFingerprint === fingerprint}
          onClose={() => setOpen(null)}
          onRemove={() => removeOwn(open)}
        />
      )}
    </section>
  );
}

function Lightbox({
  token,
  item,
  mine,
  onClose,
  onRemove,
}: {
  token: string;
  item: MediaView;
  mine: boolean;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [full, setFull] = useState<MediaView | null>(null);

  useEffect(() => {
    // Full-resolution URLs resolve only now, never for a whole page.
    const params = new URLSearchParams({ token, id: item.id });
    fetch(`/api/photo?${params}`)
      .then((r) => r.json())
      .then((data) => setFull(data?.id ? data : null))
      .catch(() => setFull(null));
  }, [token, item.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The optimised copy is what gets shown. It is a quarter of the bytes and,
  // for a HEIC upload, the difference between the photo appearing at all and a
  // broken image icon on anything that is not an iPhone.
  const viewUrl = full?.displayUrl;

  return (
    <div
      /* Safe-area padding at the bottom: on a phone the home indicator sits
         exactly where the Close button lands. */
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-pepper/92 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {item.kind === "video" ? (
          viewUrl ? (
            <video
              src={viewUrl}
              poster={item.posterUrl ?? undefined}
              controls
              playsInline
              preload="metadata"
              className="w-full rounded-xl"
            />
          ) : (
            <div className="shimmer relative aspect-video w-full overflow-hidden rounded-xl bg-hole" />
          )
        ) : viewUrl ? (
          <img src={viewUrl} alt="" className="w-full rounded-xl" />
        ) : (
          <div className="shimmer relative aspect-square w-full overflow-hidden rounded-xl bg-hole" />
        )}

        {item.processing && (
          <p className="mt-3 rounded-xl border-2 border-gouda bg-pepper px-3 py-2 text-center text-[0.8125rem] text-butter/80">
            Still being converted so it plays everywhere. Check back shortly.
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-2.5 sm:gap-3">
          <Button onClick={onClose} variant="onDark" size="sm">
            Close
          </Button>
          {full?.originalUrl && (
            <a
              href={full.originalUrl}
              download
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-2 border-pepper bg-gouda px-3.5 py-2 text-[0.9375rem] font-semibold leading-tight text-pepper shadow-[4px_4px_0_var(--color-crust)]"
            >
              Download
            </a>
          )}
          {mine && (
            <Button onClick={onRemove} variant="onDark" size="sm">
              Remove mine
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
