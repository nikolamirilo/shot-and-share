"use client";

import { useRef, useState } from "react";

import { COMPRESS_AT_ONCE, UPLOAD_AT_ONCE } from "@/constants/upload";
import type {
  Item,
  Phase,
  UploadQueueOptions,
} from "@/types/upload";
import { type Prepared, prepare } from "@/lib/client/prepare";
import { START, type Stages, runPercent } from "@/lib/client/progress";
import { sendUpload } from "@/lib/client/send-upload";
import { triage } from "@/lib/client/triage";
import { formatBytes } from "@/utils/format";
import { UploadError, gate, getFingerprint } from "@/lib/client/upload";

export function useUploadQueue({
  token,
  maxFileBytes,
  remainingBytes,
  onUploaded,
}: UploadQueueOptions) {
  const picks = useRef(0);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const waitingForTheirTurn = useRef<File[]>([]);
  const [picked, setPicked] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [upgradeHint, setUpgradeHint] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [held, setHeld] = useState(0);
  const [saved, setSaved] = useState({ from: 0, to: 0 });
  const [phase, setPhase] = useState<Phase>("preparing");
  const [running, setRunning] = useState<string[]>([]);

  function update(key: string, patch: Partial<Item>) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

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

      setSaved((prev) => ({
        from: prev.from + item.file.size,
        to: prev.to + (prepared.compressed?.size ?? item.file.size),
      }));

      advance(item.key, { prepare: 1 });

      await uploading(async () => {
        update(item.key, { status: "uploading" });
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

  async function runBatch(batch: Item[]) {
    busyRef.current = true;
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
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function addFiles(fileList: FileList | File[] | null) {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;

    if (busyRef.current) {
      waitingForTheirTurn.current.push(...files);
      return;
    }

    setError(null);
    setNotice(null);
    setUpgradeHint(false);
    setPicked(files.length);

    const { accepted, skipped } = triage(files, {
      maxFileBytes,
      room: remainingBytes - saved.to,
    });

    const noRoom = skipped.filter((s) => s.upgrade).length;
    if (noRoom > 0) {
      setUpgradeHint(true);
      setNotice(
        `There is ${formatBytes(Math.max(0, remainingBytes - saved.to))} left at this event, so ${noRoom} of the ${files.length} you picked will not fit.`,
      );
    }

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

    fetch("/api/guest/pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        picked: files.length,
        sending: accepted.length,
      }),
      keepalive: true,
    }).catch(() => {});

    setItems((prev) => [...prev, ...batch, ...refused]);
    if (batch.length > 0) await runBatch(batch);

    const queued = waitingForTheirTurn.current;
    if (queued.length > 0) {
      waitingForTheirTurn.current = [];
      await addFiles(queued);
    }
  }

  async function retryFailed() {
    const failed = items.filter((i) => i.status === "failed");
    if (failed.length === 0 || busyRef.current) return;

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
  const overall = runPercent(
    batch.map((i) => ({
      bytes: i.file.size,
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
    picked,
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
