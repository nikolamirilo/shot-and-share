"use client";

import { useRef, useState } from "react";

import { type Prepared, estimate, prepare } from "@/lib/client/prepare";
import { sendUpload } from "@/lib/client/send-upload";
import {
  UploadError,
  gate,
  getFingerprint,
  getSavedName,
  saveName,
} from "@/lib/client/upload";
import { formatBytes } from "@/lib/format";
import { MAX_FILES_PER_PICK } from "@/lib/media";

export type ItemStatus = "waiting" | "preparing" | "uploading" | "done" | "failed";

export interface Item {
  key: string;
  file: File;
  status: ItemStatus;
  progress: number;
  error?: string;
}

/**
 * What the guest is told, for the batch as a whole. Twenty filenames with
 * twenty numbers ticking beside them is a machine reporting to itself, so only
 * the files that *fail* are ever named.
 */
export type Phase = "preparing" | "uploading";

/**
 * Two gates rather than one queue, because compressing is the processor and
 * uploading is the radio: a file climbs out over the network while the next is
 * still being re-encoded, so the two costs overlap.
 */
const COMPRESS_AT_ONCE = 3;
const UPLOAD_AT_ONCE = 3;

export interface UploadQueueOptions {
  token: string;
  maxFileBytes: number;
  remainingBytes: number;
  onUploaded: () => void;
}

/**
 * The whole upload state machine, with no markup in it - the part of the guest
 * side where a mistake costs somebody their photographs.
 */
export function useUploadQueue({
  token,
  maxFileBytes,
  remainingBytes,
  onUploaded,
}: UploadQueueOptions) {
  const picks = useRef(0);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeHint, setUpgradeHint] = useState(false);
  const [name, setName] = useState<string>(() =>
    typeof window === "undefined" ? "" : getSavedName(),
  );
  const [completed, setCompleted] = useState(0);
  const [saved, setSaved] = useState({ from: 0, to: 0 });
  const [phase, setPhase] = useState<Phase>("preparing");
  /**
   * The keys of the run that is on screen now. The counter and the bar are
   * about *this* handful of photos: measuring them against `items` would mean a
   * guest who adds three more after sending twenty sees a bar already full.
   */
  const [running, setRunning] = useState<string[]>([]);

  function update(key: string, patch: Partial<Item>) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  /**
   * Everything one file goes through, on its own: a file that fails fails
   * alone, and one that lands is written to the database immediately.
   */
  async function runOne(
    item: Item,
    fingerprint: string,
    uploaderName: string | null,
    compressing: <T>(task: () => Promise<T>) => Promise<T>,
    uploading: <T>(task: () => Promise<T>) => Promise<T>,
  ): Promise<boolean> {
    try {
      const prepared: Prepared = await compressing(async () => {
        update(item.key, { status: "preparing" });
        return prepare(item.file);
      });

      // What the guest would have sent versus what they are about to send.
      setSaved((prev) => ({
        from: prev.from + item.file.size,
        to: prev.to + (prepared.compressed?.size ?? item.file.size),
      }));

      await uploading(async () => {
        update(item.key, { status: "uploading", progress: 0 });
        // Only ever forwards within a run. Compressing and uploading overlap,
        // so a phase derived from what is happening right now would flip back
        // to "optimising" every time a file finished climbing out.
        setPhase("uploading");
        await sendUpload(
          {
            presign: "/api/upload/presign",
            confirm: "/api/upload/confirm",
            identity: { token, fingerprint, uploaderName },
          },
          item.file,
          prepared,
          (fraction) =>
            update(item.key, { progress: Math.round(fraction * 100) }),
        );
      });

      update(item.key, { status: "done", progress: 100 });

      // Per photograph, not per batch: a wall that does not change for two
      // minutes and then changes all at once reads as a broken upload.
      onUploaded();
      return true;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "That one did not go through.";
      if (e instanceof UploadError && e.upgrade) setUpgradeHint(true);
      update(item.key, { status: "failed", error: message });
      return false;
    }
  }

  /**
   * Runs a set of items through both gates and reports what survived.
   *
   * Everything is inside the try, including the two lines that read the
   * fingerprint and the saved name. They look incapable of failing and are not:
   * they touch `crypto` and `localStorage`, both of which throw outright in
   * some browsers. Outside the try that left `busy` stuck on for good - the
   * button disabled, the bar at zero, no message.
   */
  async function runBatch(batch: Item[]) {
    setBusy(true);
    setPhase("preparing");
    setRunning(batch.map((item) => item.key));

    try {
      const fingerprint = getFingerprint();
      const uploaderName = name.trim() || null;
      saveName(name.trim());

      const compressing = gate(COMPRESS_AT_ONCE);
      const uploading = gate(UPLOAD_AT_ONCE);

      const results = await Promise.all(
        batch.map((item) =>
          runOne(item, fingerprint, uploaderName, compressing, uploading),
        ),
      );

      setCompleted((prev) => prev + results.filter(Boolean).length);
    } catch (e) {
      console.error("[upload] the batch could not be started", e);
      setError("Something on this device stopped the upload before it began.");
      setItems((prev) =>
        prev.map((item) =>
          batch.some((b) => b.key === item.key)
            ? { ...item, status: "failed", error: "Could not start." }
            : item,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || busy) return;

    const files = Array.from(fileList).slice(0, MAX_FILES_PER_PICK);
    setError(null);
    setUpgradeHint(false);

    const oversized = files.find((f) => f.size > maxFileBytes);
    if (oversized) {
      setError(
        `“${oversized.name}” is bigger than ${formatBytes(maxFileBytes, 0)}, which is the most we can take in one file.`,
      );
      return;
    }

    // The server checks this again once it knows the real compressed size, and
    // its answer is the one that counts. This is only here so a hopeless batch
    // fails in half a second instead of after a minute of compressing.
    const room = remainingBytes - saved.to;
    if (estimate(files) > room) {
      setError(
        `There is only ${formatBytes(Math.max(0, room))} of room left at this event, which is not enough for what you picked.`,
      );
      setUpgradeHint(true);
      return;
    }

    const batch: Item[] = files.map((file, i) => ({
      key: `${picks.current}-${i}-${file.name}`,
      file,
      status: "waiting",
      progress: 0,
    }));
    picks.current += 1;

    // Appended, not replaced: a guest adding a second handful should still see
    // the first one sitting there marked "added".
    setItems((prev) => [...prev, ...batch]);
    await runBatch(batch);
  }

  async function retryFailed() {
    const failed = items.filter((i) => i.status === "failed");
    if (failed.length === 0 || busy) return;

    setError(null);
    setUpgradeHint(false);
    setItems((prev) =>
      prev.map((item) =>
        item.status === "failed"
          ? { ...item, status: "waiting", progress: 0, error: undefined }
          : item,
      ),
    );

    await runBatch(failed.map((item) => ({ ...item, status: "waiting" })));
  }

  const failed = items.filter((i) => i.status === "failed");
  const inFlight = items.filter(
    (i) => i.status !== "done" && i.status !== "failed",
  ).length;

  const batch = items.filter((i) => running.includes(i.key));
  const sent = batch.filter((i) => i.status === "done").length;
  const overall =
    batch.length === 0
      ? 0
      : Math.round(
          batch.reduce(
            (sum, i) => sum + (i.status === "done" ? 100 : i.progress),
            0,
          ) / batch.length,
        );

  return {
    addFiles,
    retryFailed,
    busy,
    phase,
    error,
    upgradeHint,
    name,
    setName,
    completed,
    saved,
    failed,
    inFlight,
    batch,
    sent,
    overall,
  };
}
