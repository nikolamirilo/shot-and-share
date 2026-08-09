"use client";

import { useEffect, useState, useTransition } from "react";

import { deleteMedia, setCoverPhoto } from "@/app/dashboard/actions";
import { LayoutSwitcher, PhotoGallery } from "@/components/gallery";
import { Button, Hole } from "@/components/ui";
import type { MediaView } from "@/lib/events";
import {
  type GalleryLayout,
  readViewerLayout,
  writeViewerLayout,
} from "@/lib/gallery";

export function HostGallery({
  eventId,
  media,
  shareLink,
  eventLayout,
}: {
  eventId: string;
  media: MediaView[];
  shareLink: string | null;
  /** The event's default, which is what guests land on. */
  eventLayout: GalleryLayout;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<GalleryLayout>(eventLayout);

  // Start on the event's layout - which is exactly what every guest gets - and
  // let the host's own console preference take over once the browser has told
  // us there is one. It is theirs alone: it never touches the event.
  useEffect(() => {
    const preferred = readViewerLayout();
    if (preferred) setLayout(preferred);
  }, []);

  function chooseLayout(next: GalleryLayout) {
    setLayout(next);
    writeViewerLayout(next);
  }

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
      <div className="card px-5 py-8 text-center sm:p-8">
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
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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

        {/* Four layout names plus a label do not fit beside the selection
            controls on a phone, so they take their own row and scroll if even
            that is not enough. */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:overflow-visible">
          <div className="flex min-w-max lg:justify-end">
            <LayoutSwitcher
              value={layout}
              onChange={chooseLayout}
              label="View"
            />
          </div>
        </div>
      </div>

      <PhotoGallery
        items={media}
        layout={layout}
        onActivate={(item) => toggle(item.id)}
        isSelected={(item) => selected.has(item.id)}
      />

      {layout !== eventLayout && (
        <p className="mt-3 text-[0.8125rem] text-rind">
          You are viewing this your way. Guests always see the layout set under
          Event page.
        </p>
      )}

      {error && (
        <p className="mt-4 note p-3 text-[0.9375rem]">
          {error}
        </p>
      )}
    </div>
  );
}
