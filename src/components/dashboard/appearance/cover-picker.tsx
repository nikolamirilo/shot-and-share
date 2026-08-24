"use client";

import Image from "next/image";
import { useState } from "react";
import { MdOutlineImage } from "react-icons/md";

import { CoverDialog } from "@/components/dashboard/appearance/cover-dialog";
import { useCoverPhotos } from "@/components/dashboard/appearance/use-cover-photos";
import { useCoverUpload } from "@/components/dashboard/appearance/use-cover-upload";
import { Button } from "@/components/ui";
import { HIDDEN_FILE_INPUT, useAccept, useFilePicker } from "@/lib/client/picker";
import { pluralise } from "@/lib/format";
import type { MediaView } from "@/lib/media-view";

/**
 * The cover photograph: everything at the event, and anything the host brings.
 *
 * The panel keeps one tile, which answers the only question it has to answer
 * standing still - which photograph is it at the moment. Everything else is in
 * the dialog.
 */
export function CoverPicker({
  eventId,
  photos: firstPage,
  photoCount,
  covers,
  selectedId,
  selectedUrl,
  onSelect,
  maxFileBytes,
  remainingBytes,
}: {
  eventId: string;
  photos: MediaView[];
  photoCount: number;
  covers: MediaView[];
  selectedId: string | null;
  /** What the drawing is showing, so the tile and the preview cannot disagree. */
  selectedUrl: string | null;
  onSelect: (item: MediaView | null) => void;
  maxFileBytes: number;
  remainingBytes: number;
}) {
  const [open, setOpen] = useState(false);
  const accept = useAccept(false);

  const browse = useCoverPhotos(eventId, firstPage, photoCount);

  /** Picking is the whole reason the dialog is open, so it also closes it. */
  function choose(item: MediaView | null) {
    onSelect(item);
    setOpen(false);
  }

  const uploader = useCoverUpload({
    eventId,
    maxFileBytes,
    initial: covers,
    // Uploading a cover is choosing one, so it lands the same way a tap does
    // and hands the host back to the drawing. It is still only a draft: the row
    // is not touched until Save changes.
    onUploaded: choose,
    onRemoved: (item) => {
      if (selectedId === item.id) onSelect(null);
    },
  });

  // Same wiring as the guest page, for the same reason: the picker is a native
  // sheet, and what it hands back has to be caught however it arrives.
  const picker = useFilePicker((files) => {
    const file = files[0];
    if (file) void uploader.upload(file);
  });

  const error = uploader.error ?? browse.error;

  return (
    <>
      {/* Outside the dialog on purpose. It is what the Upload button clicks,
          and the dialog closes on a successful upload - an input inside it
          would be gone before the handler had finished tidying up. */}
      <input
        ref={picker.inputRef}
        type="file"
        accept={accept}
        id="cover-file"
        className={HIDDEN_FILE_INPUT}
        tabIndex={-1}
        aria-hidden
      />

      <div className="flex flex-wrap items-center gap-3">
        <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-linen shadow-md">
          {selectedUrl ? (
            <Image
              src={selectedUrl}
              alt=""
              width={128}
              height={128}
              sizes="128px"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-mono text-micro uppercase text-mist">
              none
            </span>
          )}
        </span>

        <div className="min-w-0">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setOpen(true)}
          >
            <MdOutlineImage aria-hidden className="shrink-0 text-[1.25em]" />
            {selectedUrl ? "Change the cover photo" : "Choose a cover photo"}
          </Button>
          <p className="mt-1.5 text-label text-ash">
            {photoCount === 0
              ? "No photos from guests yet - you can upload your own."
              : `${pluralise(photoCount, "photo")} from the event, or upload your own.`}
          </p>
        </div>
      </div>

      {/* The error lives out here too. An upload that failed after the host had
          already closed the dialog would otherwise report to an empty room. */}
      {!open && error && (
        <p className="note mt-3 p-3 text-label font-semibold leading-snug">
          {error}
        </p>
      )}

      {open && (
        <CoverDialog
          photos={browse.photos}
          uploads={uploader.uploads}
          photoCount={photoCount}
          selectedId={selectedId}
          remainingBytes={remainingBytes}
          more={browse.more}
          loading={browse.loading}
          uploading={uploader.progress}
          removing={uploader.removing}
          error={error}
          onChoose={choose}
          onClose={() => setOpen(false)}
          onLoadMore={() => void browse.loadMore()}
          onPickFile={picker.open}
          onRemove={(item) => void uploader.remove(item)}
        />
      )}
    </>
  );
}
