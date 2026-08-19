"use client";

import { useRef, useState } from "react";

import { type Prepared, prepare } from "@/lib/client/prepare";
import { START, type Stages, runPercent } from "@/lib/client/progress";
import { sendUpload } from "@/lib/client/send-upload";
import { triage } from "@/lib/client/triage";
import { UploadError, gate, getFingerprint } from "@/lib/client/upload";

/**
 * "skipped" is a file that was never sent: over the size limit, or no room
 * for it. Named in the same list as the failures, so the guest can see which
 * one and why, but kept apart from them because retrying it would only fail
 * again the same way.
 */
export type ItemStatus =
  | "waiting"
  | "preparing"
  | "uploading"
  | "done"
  | "failed"
  | "skipped";

export interface Item {
  key: string;
  file: File;
  status: ItemStatus;
  /**
   * How far through its own journey this file is, stage by stage. Not a single
   * number: encoding, uploading and being written down are three different
   * waits, and measuring only the middle one is what made the bar jump.
   */
  stages: Stages;
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
  /** How many one tap takes; the rest are named and left for the next tap. */
  filesPerPick: number;
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
  filesPerPick,
  remainingBytes,
  onUploaded,
}: UploadQueueOptions) {
  const picks = useRef(0);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Something worth saying that is not a failure: "the first 100 are going". */
  const [notice, setNotice] = useState<string | null>(null);
  const [upgradeHint, setUpgradeHint] = useState(false);
  const [completed, setCompleted] = useState(0);
  /**
   * How many of this guest's uploads are waiting on the host.
   *
   * Counted so the thank-you note can say so. A photo that uploaded, said
   * "thank you", and then never appears on the wall reads to a guest as a
   * failure, and they upload it again.
   */
  const [held, setHeld] = useState(0);
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

  /** One stage of one file moved. Never backwards - see lib/client/progress. */
  function advance(key: string, patch: Partial<Stages>) {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key
          ? {
              ...item,
              stages: {
                ...item.stages,
                ...patch,
                ...(patch.prepare !== undefined && {
                  prepare: Math.max(item.stages.prepare, patch.prepare),
                }),
                ...(patch.upload !== undefined && {
                  upload: Math.max(item.stages.upload, patch.upload),
                }),
              },
            }
          : item,
      ),
    );
  }

  /**
   * Everything one file goes through, on its own: a file that fails fails
   * alone, and one that lands is written to the database immediately.
   */
  async function runOne(
    item: Item,
    fingerprint: string,
    compressing: <T>(task: () => Promise<T>) => Promise<T>,
    uploading: <T>(task: () => Promise<T>) => Promise<T>,
  ): Promise<boolean> {
    try {
      const prepared: Prepared = await compressing(async () => {
        update(item.key, { status: "preparing" });
        return prepare(item.file, (fraction) =>
          advance(item.key, { prepare: fraction }),
        );
      });

      // What the guest would have sent versus what they are about to send.
      setSaved((prev) => ({
        from: prev.from + item.file.size,
        to: prev.to + (prepared.compressed?.size ?? item.file.size),
      }));

      // Whatever the encoder managed to report, it is finished now.
      advance(item.key, { prepare: 1 });

      await uploading(async () => {
        update(item.key, { status: "uploading" });
        // Only ever forwards within a run. Compressing and uploading overlap,
        // so a phase derived from what is happening right now would flip back
        // to "optimising" every time a file finished climbing out.
        setPhase("uploading");
        const result = await sendUpload<{
          confirmed: boolean;
          held?: boolean;
        }>(
          {
            presign: "/api/upload/presign",
            confirm: "/api/upload/confirm",
            identity: { token, fingerprint },
          },
          item.file,
          prepared,
          (fraction) => advance(item.key, { upload: fraction }),
        );

        if (result.confirmation.held) setHeld((prev) => prev + 1);
      });

      update(item.key, {
        status: "done",
        stages: { prepare: 1, upload: 1, confirmed: true },
      });

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
   * Everything is inside the try, including the line that reads the
   * fingerprint. It looks incapable of failing and is not: it touches `crypto`
   * and `localStorage`, both of which throw outright in some browsers. Outside
   * the try that left `busy` stuck on for good - the button disabled, the bar
   * at zero, no message.
   */
  async function runBatch(batch: Item[]) {
    setBusy(true);
    setPhase("preparing");
    setRunning(batch.map((item) => item.key));

    try {
      const fingerprint = getFingerprint();

      const compressing = gate(COMPRESS_AT_ONCE);
      const uploading = gate(UPLOAD_AT_ONCE);

      const results = await Promise.all(
        batch.map((item) => runOne(item, fingerprint, compressing, uploading)),
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

    setError(null);
    setNotice(null);
    setUpgradeHint(false);

    // File by file, never all-or-nothing: one clip over the limit used to
    // stop sixty photographs going anywhere. See lib/client/triage.
    const { accepted, skipped, leftOut } = triage(Array.from(fileList), {
      maxFileBytes,
      room: remainingBytes - saved.to,
      maxCount: filesPerPick,
    });

    if (leftOut > 0) {
      setNotice(
        `That was ${fileList.length}. The first ${filesPerPick} are on their way - add the other ${leftOut} once these are done.`,
      );
    }
    if (skipped.some((s) => s.upgrade)) setUpgradeHint(true);

    const pick = picks.current;
    picks.current += 1;

    const batch: Item[] = accepted.map((file, i) => ({
      key: `${pick}-${i}-${file.name}`,
      file,
      status: "waiting",
      stages: START,
    }));
    const refused: Item[] = skipped.map(({ file, reason }, i) => ({
      key: `${pick}-skipped-${i}-${file.name}`,
      file,
      status: "skipped",
      stages: START,
      error: reason,
    }));

    // Appended, not replaced: a guest adding a second handful should still see
    // the first one sitting there marked "added".
    setItems((prev) => [...prev, ...batch, ...refused]);
    if (batch.length > 0) await runBatch(batch);
  }

  async function retryFailed() {
    const failed = items.filter((i) => i.status === "failed");
    if (failed.length === 0 || busy) return;

    setError(null);
    setUpgradeHint(false);
    setItems((prev) =>
      prev.map((item) =>
        item.status === "failed"
          ? { ...item, status: "waiting", stages: START, error: undefined }
          : item,
      ),
    );

    await runBatch(
      failed.map((item) => ({ ...item, status: "waiting", stages: START })),
    );
  }

  const failed = items.filter((i) => i.status === "failed");
  const skipped = items.filter((i) => i.status === "skipped");
  const inFlight = items.filter(
    (i) =>
      i.status !== "done" && i.status !== "failed" && i.status !== "skipped",
  ).length;

  const batch = items.filter((i) => running.includes(i.key));
  const sent = batch.filter((i) => i.status === "done").length;
  /*
   * Byte-weighted across the run, so a 200 MB clip is not worth the same as a
   * 2 MB photo. A file that failed still counts as finished waiting: leaving
   * it at whatever fraction it died on would hold the bar short of the end for
   * a file nothing is going to do anything more about.
   */
  const overall = runPercent(
    batch.map((i) => ({
      bytes: i.file.size,
      // A clip is not transcoded on the phone, so its preparing step is worth
      // far less of the wait than a photo's two encodes.
      kind: i.file.type.startsWith("video/")
        ? ("video" as const)
        : ("photo" as const),
      stages:
        i.status === "failed"
          ? { prepare: 1, upload: 1, confirmed: true }
          : i.stages,
    })),
  );

  return {
    addFiles,
    retryFailed,
    busy,
    phase,
    error,
    notice,
    upgradeHint,
    completed,
    held,
    saved,
    failed,
    skipped,
    inFlight,
    batch,
    sent,
    overall,
  };
}
