"use client";

import { useRef, useState } from "react";

import { Button, Hole, ProgressBar, cx } from "@/components/ui";
import { UploadPanel } from "@/components/upload/upload-panel";
import type { UploadVariant } from "@/lib/appearance/variants";
import { type Prepared, estimate, prepare } from "@/lib/client/prepare";
import {
  UploadError,
  gate,
  getFingerprint,
  getSavedName,
  postJson,
  saveName,
  uploadToPresigned,
  withRetry,
} from "@/lib/client/upload";
import { formatBytes } from "@/lib/format";
import {
  ACCEPT_ATTRIBUTE_ALL,
  ACCEPT_ATTRIBUTE_PHOTO,
  MAX_FILES_PER_PICK,
} from "@/lib/media";
import type { PresignedUpload } from "@/lib/storage/types";

type ItemStatus = "waiting" | "preparing" | "uploading" | "done" | "failed";

interface Item {
  key: string;
  file: File;
  status: ItemStatus;
  progress: number;
  error?: string;
}

interface PresignResponse {
  upload: {
    mediaId: string;
    /** "compressed" means send the re-encoded copy, not the file off the disk. */
    source: "file" | "compressed";
    media: PresignedUpload;
    poster: PresignedUpload | null;
  };
}

/**
 * How many files are compressed, and uploaded, at the same time.
 *
 * Two separate gates rather than one queue, because they are two different
 * machines: compressing is the processor and uploading is the radio. A file
 * that has finished compressing climbs out over the network while the next one
 * is still being re-encoded, so the two costs overlap instead of being paid one
 * after the other. Before this the guest watched every photo shrink before a
 * single byte left the phone.
 */
const COMPRESS_AT_ONCE = 3;
const UPLOAD_AT_ONCE = 3;

/**
 * The guest side is one screen and it stays that way.
 *
 * Every extra field here is a guest who does not upload, and a guest who opens
 * the link without uploading is the clearest signal that the product is broken.
 * So: no sign-in, no explanation, one big button, and the name field is
 * optional and remembered.
 */
export function Uploader({
  token,
  variant,
  allowVideo,
  maxFileBytes,
  remainingBytes,
  onUploaded,
}: {
  token: string;
  /** The shape the host picked for this event. */
  variant: UploadVariant;
  allowVideo: boolean;
  maxFileBytes: number;
  remainingBytes: number;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
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

  function update(key: string, patch: Partial<Item>) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  /**
   * Everything one file goes through, start to finish, on its own.
   *
   * The whole batch used to share a single chain - compress all, presign all,
   * upload all, confirm all - which meant one unreadable file took twenty
   * photos down with it and nothing was committed until the last one landed.
   * Now a file that fails fails alone, and a file that lands is written to the
   * database immediately, so a guest who closes the tab halfway keeps
   * everything that already went up.
   */
  async function runOne(
    item: Item,
    fingerprint: string,
    uploaderName: string | null,
    compressing: <T>(task: () => Promise<T>) => Promise<T>,
    uploading: <T>(task: () => Promise<T>) => Promise<T>,
  ): Promise<boolean> {
    try {
      const prepared = await compressing(async () => {
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
        await send(item, prepared, fingerprint, uploaderName);
      });

      update(item.key, { status: "done", progress: 100 });
      return true;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "That one did not go through.";
      if (e instanceof UploadError && e.upgrade) setUpgradeHint(true);
      update(item.key, { status: "failed", error: message });
      return false;
    }
  }

  /** Ask for a URL, send the bytes, then write the row. */
  async function send(
    item: Item,
    prepared: Prepared,
    fingerprint: string,
    uploaderName: string | null,
  ) {
    const { upload } = await withRetry(() =>
      postJson<PresignResponse>("/api/upload/presign", {
        token,
        fingerprint,
        uploaderName,
        file: prepared.descriptor,
      }),
    );

    const body =
      upload.source === "compressed" && prepared.compressed
        ? prepared.compressed
        : item.file;

    let posterUploaded = false;

    try {
      await withRetry(() =>
        uploadToPresigned(upload.media, body, (fraction) =>
          update(item.key, { progress: Math.round(fraction * 100) }),
        ),
      );

      // A video's poster is cosmetic and the worker can cut another one. It
      // failing must never cost the clip.
      if (upload.poster && prepared.poster) {
        try {
          await uploadToPresigned(upload.poster, prepared.poster);
          posterUploaded = true;
        } catch (e) {
          // Logged rather than swallowed: a poster that never uploads at any
          // event is a bucket problem, and a silent catch is how it stays
          // invisible for a month.
          console.error("[upload] poster failed, keeping the clip", e);
        }
      }
    } catch (e) {
      /*
       * Hand the reserved space back before giving up, so a failed upload does
       * not sit on the host's quota until the nightly sweep.
       */
      await confirm(fingerprint, upload.mediaId, prepared, false, false).catch(
        () => {
          /* the sweep is the backstop */
        },
      );
      throw e;
    }

    /*
     * The bytes are in the bucket. Confirming is what turns them into a photo,
     * so it is worth retrying hard: losing the picture because a four hundred
     * byte acknowledgement did not get through would be the worst trade in the
     * system.
     */
    const result = await withRetry(() =>
      confirm(fingerprint, upload.mediaId, prepared, true, posterUploaded),
    );

    if (!result.confirmed) {
      throw new UploadError("The host's gallery would not accept it.");
    }
  }

  function confirm(
    fingerprint: string,
    mediaId: string,
    prepared: Prepared,
    mediaUploaded: boolean,
    posterUploaded: boolean,
  ) {
    return postJson<{ confirmed: boolean }>("/api/upload/confirm", {
      token,
      fingerprint,
      mediaId,
      width: prepared.sourceWidth,
      height: prepared.sourceHeight,
      mediaUploaded,
      posterUploaded,
      failed: !mediaUploaded,
    });
  }

  /** Runs a set of items through both gates and reports what survived. */
  async function runBatch(batch: Item[]) {
    setBusy(true);
    const fingerprint = getFingerprint();
    const uploaderName = name.trim() || null;
    saveName(name.trim());

    const compressing = gate(COMPRESS_AT_ONCE);
    const uploading = gate(UPLOAD_AT_ONCE);

    try {
      const results = await Promise.all(
        batch.map((item) =>
          runOne(item, fingerprint, uploaderName, compressing, uploading),
        ),
      );

      const succeeded = results.filter(Boolean).length;
      setCompleted((prev) => prev + succeeded);
      if (succeeded > 0) onUploaded();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  async function handleFiles(fileList: FileList | null) {
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

  const failedCount = items.filter((i) => i.status === "failed").length;
  const inFlight = items.filter(
    (i) => i.status !== "done" && i.status !== "failed",
  ).length;
  const overall =
    items.length === 0
      ? 0
      : Math.round(
          items.reduce(
            (sum, i) => sum + (i.status === "done" ? 100 : i.progress),
            0,
          ) / items.length,
        );

  const accept = allowVideo ? ACCEPT_ATTRIBUTE_ALL : ACCEPT_ATTRIBUTE_PHOTO;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        onChange={(e) => handleFiles(e.target.files)}
        className="sr-only"
        id="guest-files"
      />
      {/* The camera is a second input rather than an attribute on the first:
          `capture` turns the picker into a viewfinder for every use of it, and
          the library button has to keep working. */}
      {variant === "split" && (
        <input
          ref={cameraRef}
          type="file"
          accept={accept}
          capture="environment"
          onChange={(e) => handleFiles(e.target.files)}
          className="sr-only"
          id="guest-camera"
        />
      )}

      <UploadPanel
        variant={variant}
        busy={busy}
        label={busy ? `Uploading… ${overall}%` : "Add your photos"}
        hint={`${
          allowVideo
            ? `Photos and video, up to ${MAX_FILES_PER_PICK} at a time.`
            : `Photos, up to ${MAX_FILES_PER_PICK} at a time.`
        } ${formatBytes(remainingBytes)} of room left.`}
        name={name}
        onNameChange={setName}
        onPick={() => inputRef.current?.click()}
        onCapture={() => cameraRef.current?.click()}
        onDropFiles={handleFiles}
      >
        {items.length > 0 && (
          <div className="mt-6">
            <ProgressBar percent={overall} />
            <ul className="mt-4 space-y-2">
              {items.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center gap-3 text-[0.9375rem]"
                >
                  <Hole
                    size={11}
                    className={cx(
                      item.status === "done" && "bg-ink",
                      item.status === "failed" && "opacity-40",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {item.file.name}
                  </span>
                  <span className="shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-mist">
                    {item.status === "done"
                      ? "added"
                      : item.status === "failed"
                        ? "failed"
                        : item.status === "uploading"
                          ? `${item.progress}%`
                          : item.status === "preparing"
                            ? "shrinking"
                            : "waiting"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* A partial failure used to show a thank-you and nothing else, so a
            guest had no way of knowing three of their ten were missing and no
            way to send them again without hunting through a camera roll. */}
        {failedCount > 0 && !busy && (
          <div className="mt-5 note p-4">
            <p className="text-[0.9375rem] font-semibold">
              {failedCount === 1
                ? "One did not make it."
                : `${failedCount} did not make it.`}
            </p>
            <p className="mt-1.5 text-[0.9375rem] text-ash">
              {items.find((i) => i.status === "failed")?.error ??
                "The connection dropped."}
            </p>
            <Button
              size="md"
              variant="secondary"
              onClick={retryFailed}
              className="mt-3"
            >
              {failedCount === 1 ? "Try again" : `Try ${failedCount} again`}
            </Button>
          </div>
        )}

        {completed > 0 && inFlight === 0 && !busy && (
          <p className="mt-5 rounded-xl bg-blush shadow-sm p-4 text-center">
            <strong>Thank you.</strong>{" "}
            {completed === 1
              ? "Your photo is with the host."
              : `All ${completed} are with the host.`}{" "}
            Add more any time tonight.
            {saved.from > saved.to && saved.to > 0 && (
              <span className="mt-1 block font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ash">
                sent {formatBytes(saved.to)} instead of {formatBytes(saved.from)}
              </span>
            )}
          </p>
        )}

        {error && (
          <div className="mt-5 note p-4">
            <p className="text-[0.9375rem] font-semibold">{error}</p>
            {upgradeHint && (
              <p className="mt-1.5 text-[0.9375rem] text-ash">
                The host needs to make more room. Let them know - they can raise
                the limit from their phone in under a minute.
              </p>
            )}
          </div>
        )}
      </UploadPanel>
    </>
  );
}
