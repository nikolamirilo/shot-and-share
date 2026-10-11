"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MdOutlineDeleteOutline } from "react-icons/md";

import { DemoGallery } from "@/components/demo/DemoGallery";
import { Button } from "@/components/ui";
import { UploadPanel } from "@/components/upload/UploadPanel";
import { HIDDEN_FILE_INPUT } from "@/constants/upload";
import { useAccept } from "@/hooks/upload/useAccept";
import { useFilePicker } from "@/hooks/upload/useFilePicker";
import {
  type DemoPhoto,
  clearDemoPhotos,
  readDemoPhotos,
  shrinkForDemo,
  toMediaView,
  writeDemoPhotos,
} from "@/lib/client/demo-photos";

/**
 * The guest page with a working "Add your photos", for people who have not
 * made an event yet. The photos stay in this browser - see @/lib/client/demo-photos.
 */
export function DemoStage() {
  const [photos, setPhotos] = useState<DemoPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Read after mounting, so the server render and the first client render agree.
  useEffect(() => setPhotos(readDemoPhotos()), []);

  const add = async (files: File[]) => {
    setBusy(true);
    setNotice(null);

    const added: DemoPhoto[] = [];
    let clips = 0;
    let unreadable = 0;

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        clips += 1;
        continue;
      }
      const photo = await shrinkForDemo(file);
      if (photo) added.push(photo);
      else unreadable += 1;
    }

    const held = readDemoPhotos();
    const kept = writeDemoPhotos([...added, ...held]);
    setPhotos(kept);
    setBusy(false);
    const dropped = held.length + added.length - kept.length;
    setNotice(
      unreadable > 0
        ? `${unreadable === 1 ? "One photo" : `${unreadable} photos`} could not be read in this browser. HEIC from an iPhone usually needs Safari - at a real event the server converts it.`
        : clips > 0
          ? "Video works at a real event, but this demo only keeps photos."
          : added.length > 0 && kept.length === 0
            ? "This browser has no room left to keep them. At a real event they would go straight to the host."
            : dropped > 0
              ? `A browser only holds so much, so the demo keeps your last ${kept.length}. The oldest made way.`
              : null,
    );
  };

  const picker = useFilePicker((files) => void add(files));
  const accept = useAccept(false);

  const clear = () => {
    clearDemoPhotos();
    setPhotos([]);
    setNotice(null);
  };

  return (
    <>
      <input
        ref={picker.inputRef}
        type="file"
        multiple
        accept={accept}
        className={HIDDEN_FILE_INPUT}
        tabIndex={-1}
        aria-hidden
        id="demo-files"
      />

      <UploadPanel
        variant="button"
        consent={false}
        busy={busy}
        label={busy ? "Adding…" : "Add your photos"}
        hint="Straight from your camera roll. They stay on this device."
        pickFor="demo-files"
        onPick={picker.open}
        onDropFiles={(files) => void add(Array.from(files))}
      >
        {photos.length > 0 && (
          <div className="mt-5 rounded-xl bg-blush shadow-sm p-4 text-center">
            <p>
              <strong>
                {photos.length === 1
                  ? "Your photo is in the gallery."
                  : `Your ${photos.length} photos are in the gallery.`}
              </strong>{" "}
              They are saved in this browser and nowhere else.
            </p>
            <Button size="sm" variant="secondary" onClick={clear} className="mt-3">
              <MdOutlineDeleteOutline aria-hidden className="shrink-0 text-[1.25em]" />
              Remove mine
            </Button>
          </div>
        )}

        {notice && <p className="mt-5 note p-4 text-[0.9375rem]">{notice}</p>}

        <p className="sr-only" aria-live="polite">
          {busy ? "Adding" : ""}
        </p>
      </UploadPanel>

      <p className="mt-3 text-center text-[0.9375rem] text-ash">
        Nothing is uploaded here, because there is no real event behind this
        page - your photos are kept on this device and go no further.{" "}
        <Link href="/login" className="underline underline-offset-2">
          Create a free event
        </Link>{" "}
        and the same button sends them to your gallery.
      </p>

      <DemoGallery added={photos.map(toMediaView)} />
    </>
  );
}
