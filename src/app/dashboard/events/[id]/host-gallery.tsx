"use client";

import { useState, useTransition } from "react";

import { deleteMedia, setCoverPhoto } from "@/app/dashboard/actions";
import { Button, Hole, cx } from "@/components/ui";
import type { MediaView } from "@/lib/events";
import { formatDateTime } from "@/lib/format";

export function HostGallery({
  eventId,
  media,
  shareLink,
}: {
  eventId: string;
  media: MediaView[];
  shareLink: string | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function remove() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (
      !confirm(
        `Delete ${ids.length === 1 ? "this photo" : `these ${ids.length} photos`}? This cannot be undone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteMedia(eventId, ids);
      if (result.error) setError(result.error);
      else setSelected(new Set());
    });
  }

  function makeCover() {
    const [id] = [...selected];
    if (!id) return;
    startTransition(async () => {
      const result = await setCoverPhoto(eventId, id);
      if (result.error) setError(result.error);
      else setSelected(new Set());
    });
  }

  if (media.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto flex w-fit gap-2">
          <Hole size={18} />
          <Hole size={26} />
          <Hole size={14} />
        </div>
        <p className="mt-5 text-lead">No photos yet.</p>
        <p className="mx-auto mt-2 max-w-md text-[0.9375rem] text-crust">
          Send the link to one person and ask them to upload something. It is the
          fastest way to see the whole thing work before the day itself.
        </p>
        {shareLink && (
          <p className="mt-4 break-all font-mono text-[0.8125rem] text-rind">
            {shareLink}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-[0.9375rem] text-crust">
          {selected.size === 0
            ? "Tap a photo to select it."
            : `${selected.size} selected`}
        </p>
        {selected.size > 0 && (
          <>
            <Button
              onClick={remove}
              size="sm"
              variant="secondary"
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete selected"}
            </Button>
            {selected.size === 1 && (
              <Button
                onClick={makeCover}
                size="sm"
                variant="ghost"
                disabled={pending}
              >
                Use as cover
              </Button>
            )}
            <Button
              onClick={() => setSelected(new Set())}
              size="sm"
              variant="ghost"
            >
              Clear
            </Button>
          </>
        )}
      </div>

      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
        {media.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-pressed={isSelected}
                aria-label={`${item.kind} uploaded ${formatDateTime(item.createdAt)}`}
                className={cx(
                  "hole relative block aspect-square w-full overflow-hidden transition-transform",
                  isSelected
                    ? "scale-95 ring-4 ring-pepper ring-offset-2 ring-offset-butter"
                    : "hover:scale-[1.03]",
                )}
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

                {item.kind === "video" && (
                  <span className="absolute bottom-1 left-1 rounded-full bg-pepper px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-butter">
                    video
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-4 rounded-xl border-2 border-pepper bg-cream p-3 text-[0.9375rem]">
          {error}
        </p>
      )}
    </div>
  );
}
