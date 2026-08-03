"use client";

import { useCallback, useEffect, useState } from "react";

import { Button, Hole } from "@/components/ui";
import { getFingerprint } from "@/lib/client/upload";
import type { MediaView } from "@/lib/events";

/**
 * What everyone else has uploaded. Guests genuinely like seeing the night from
 * other people's phones, which is why this is on by default — but it is the
 * host's switch, and when they turn it off the page is upload-only.
 */
export function GuestGallery({
  token,
  refreshKey,
}: {
  token: string;
  refreshKey: number;
}) {
  const [items, setItems] = useState<MediaView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<MediaView | null>(null);
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
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-h2">Everyone&apos;s photos</h2>
        {items.length > 0 && (
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
            {items.length} so far
          </span>
        )}
      </div>

      {items.length === 0 && !loading ? (
        <div className="mt-6 rounded-[1.25rem] border-2 border-dashed border-rind p-8 text-center">
          <div className="mx-auto flex w-fit gap-2">
            <Hole size={16} />
            <Hole size={24} />
            <Hole size={12} />
          </div>
          <p className="mt-5 text-lead">Nothing here yet.</p>
          <p className="mt-1 text-[0.9375rem] text-crust">
            Be the first — yours will appear right here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setOpen(item)}
                className="hole relative block aspect-square w-full overflow-hidden transition-transform hover:scale-[1.03]"
                aria-label="Open photo"
              >
                {item.thumbUrl ? (
                  <img
                    src={item.thumbUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-gouda-light">
                    {item.kind}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
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
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    // The full-resolution original resolves only now, never for a whole page.
    const params = new URLSearchParams({ token, id: item.id });
    fetch(`/api/photo?${params}`)
      .then((r) => r.json())
      .then((data) => setUrl(data.originalUrl ?? null))
      .catch(() => setUrl(null));
  }, [token, item.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-pepper/92 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-2xl overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {item.kind === "video" && url ? (
          <video src={url} controls className="w-full rounded-xl" />
        ) : url ? (
          <img src={url} alt="" className="w-full rounded-xl" />
        ) : (
          <div className="shimmer relative aspect-square w-full overflow-hidden rounded-xl bg-hole" />
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Button onClick={onClose} variant="onDark" size="sm">
            Close
          </Button>
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
