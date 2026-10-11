"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  MdOutlineClose,
  MdOutlineDelete,
  MdOutlineImage,
} from "react-icons/md";

import { useServerAction } from "@/hooks/useServerAction";

import { deleteMedia, setCoverPhoto } from "@/lib/actions/media";
import { PhotoGallery } from "@/components/gallery/PhotoGallery";
import { Segmented } from "@/components/gallery/Segmented";
import { Alert, Button, Hole } from "@/components/ui";
import { DEFAULT_SORT, GALLERY_SORTS, type GallerySort } from "@/constants/gallery";
import { type MediaView } from "@/types/media";
import { type GalleryLayout } from "@/constants/gallery";

export function HostGallery({
  eventId,
  media,
  shareLink,
  layout,
}: {
  eventId: string;
  media: MediaView[];
  shareLink: string | null;
  layout: GalleryLayout;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { pending, error, run } = useServerAction();
  const [kind, setKind] = useState<MediaView["kind"]>("photo");
  const [sort, setSort] = useState<GallerySort>(DEFAULT_SORT);
  const router = useRouter();

  const photoCount = media.filter((item) => item.kind === "photo").length;
  const videoCount = media.length - photoCount;
  const shownKind = photoCount === 0 && videoCount > 0 ? "video" : kind;
  const shown = media
    .filter((item) => item.kind === shownKind)
    .sort((a, b) => {
      const at = (item: MediaView) =>
        sort === "taken" ? item.takenAt : item.createdAt;
      return at(a) < at(b) ? 1 : at(a) > at(b) ? -1 : 0;
    });

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
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
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
              <MdOutlineDelete aria-hidden className="shrink-0 text-[1.25em]" />
              {pending ? "Deleting…" : "Delete selected"}
            </Button>
            {selected.size === 1 && (
              <Button
                onClick={makeCover}
                size="sm"
                variant="ghost"
                disabled={pending}
              >
                <MdOutlineImage aria-hidden className="shrink-0 text-[1.25em]" />
                Use as cover
              </Button>
            )}
            <Button
              onClick={() => setSelected(new Set())}
              size="sm"
              variant="ghost"
            >
              <MdOutlineClose aria-hidden className="shrink-0 text-[1.25em]" />
              Clear
            </Button>
          </>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {videoCount > 0 && (
          <Segmented
            label="Show"
            value={shownKind}
            options={[
              { id: "photo", name: "Photos", count: photoCount },
              { id: "video", name: "Videos", count: videoCount },
            ]}
            onChange={(next) => {
              setKind(next);
              setSelected(new Set());
            }}
          />
        )}
        <Segmented
          label="Order"
          value={sort}
          options={GALLERY_SORTS}
          onChange={setSort}
          className="sm:ml-auto"
        />
      </div>

      <PhotoGallery
        items={shown}
        layout={layout}
        onActivate={(item) => toggle(item.id)}
        isSelected={(item) => selected.has(item.id)}
      />

      {error && <Alert className="mt-4">{error}</Alert>}
    </div>
  );
}
