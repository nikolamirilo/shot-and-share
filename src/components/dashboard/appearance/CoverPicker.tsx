"use client";

import { useState } from "react";
import { MdOutlineImage } from "react-icons/md";

import { CoverDialog } from "@/components/dashboard/appearance/CoverDialog";
import { useCoverPhotos } from "@/hooks/appearance/useCoverPhotos";
import { useCoverUpload } from "@/hooks/appearance/useCoverUpload";
import { Button, Photo } from "@/components/ui";
import { HIDDEN_FILE_INPUT } from "@/constants/upload";
import { useAccept } from "@/hooks/upload/useAccept";
import { useFilePicker } from "@/hooks/upload/useFilePicker";
import { pluralise } from "@/utils/format";
import { type MediaView } from "@/types/media";

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
  selectedUrl: string | null;
  onSelect: (item: MediaView | null) => void;
  maxFileBytes: number;
  remainingBytes: number;
}) {
  const [open, setOpen] = useState(false);
  const accept = useAccept(false);

  const browse = useCoverPhotos(eventId, firstPage, photoCount);

  function choose(item: MediaView | null) {
    onSelect(item);
    setOpen(false);
  }

  const uploader = useCoverUpload({
    eventId,
    maxFileBytes,
    initial: covers,
    onUploaded: choose,
    onRemoved: (item) => {
      if (selectedId === item.id) onSelect(null);
    },
  });

  const picker = useFilePicker((files) => {
    const file = files[0];
    if (file) void uploader.upload(file);
  });

  const error = uploader.error ?? browse.error;

  return (
    <>
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
            <Photo
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
