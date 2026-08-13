"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useServerAction } from "@/hooks/use-server-action";

import { deleteMedia, setCoverPhoto } from "@/lib/actions/media";
import { LayoutSwitcher } from "@/components/gallery/layout-switcher";
import { PhotoGallery } from "@/components/gallery/photo-gallery";
import { Alert, Button, Hole } from "@/components/ui";
import type { MediaView } from "@/lib/media-view";
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
  const { pending, error, run } = useServerAction();
  const [layout, setLayout] = useState<GalleryLayout>(eventLayout);
  const router = useRouter();

  /**
   * The wall is rendered on the server, once, and guests keep uploading after
   * that. A host who leaves the dashboard open on a laptop all evening was
   * looking at the party as it stood when the page loaded, with no way of
   * knowing it - so coming back to the tab asks the server again.
   *
   * On return to the tab rather than on a timer: the photographs are only worth
   * fetching when somebody is there to look at them, and the page is not cheap
   * to render - it signs a URL per photograph.
   */
  const lastRefresh = useRef(0);
  useEffect(() => {
    const REFRESH_NO_MORE_THAN_EVERY = 10_000;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefresh.current < REFRESH_NO_MORE_THAN_EVERY) return;
      lastRefresh.current = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

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
    run(() => deleteMedia(eventId, ids), {
      confirm: `Delete ${ids.length === 1 ? "this photo" : `these ${ids.length} photos`}? This cannot be undone.`,
      onSuccess: () => setSelected(new Set()),
    });
  }

  function makeCover() {
    const [id] = [...selected];
    if (!id) return;
    run(() => setCoverPhoto(eventId, id), {
      onSuccess: () => setSelected(new Set()),
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
        <p className="mx-auto mt-2 max-w-md text-[0.9375rem] text-ash">
          Send the link to one person and ask them to upload something. It is the
          fastest way to see the whole thing work before the day itself.
        </p>
        {shareLink && (
          <p className="mt-4 break-all font-mono text-[0.8125rem] text-mist">
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
          <p className="text-[0.9375rem] text-ash">
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
        <p className="mt-3 text-[0.8125rem] text-mist">
          You are viewing this your way. Guests always see the layout set under
          Event page.
        </p>
      )}

      {error && <Alert className="mt-4">{error}</Alert>}
    </div>
  );
}
