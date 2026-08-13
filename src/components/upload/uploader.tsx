"use client";

import { useRef, useState } from "react";

import { Button, Hole, ProgressBar } from "@/components/ui";
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

/**
 * What the guest is told is happening, for the batch as a whole.
 *
 * Per-file rows were the old answer and they were the wrong one: twenty
 * filenames with twenty numbers ticking beside them is a machine reporting to
 * itself. A guest wants one line telling them it is working and roughly how far
 * along it is. Only the files that *fail* are ever named, because that is the
 * one moment the name matters.
 */
type Phase = "preparing" | "uploading";

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
  const [phase, setPhase] = useState<Phase>("preparing");
  /**
   * The keys of the run that is on screen now.
   *
   * The counter and the bar are about *this* handful of photos. Measuring them
   * against `items` would mean a guest who adds three more after sending twenty
   * sees a bar that is already almost full.
   */
  const [running, setRunning] = useState<string[]>([]);

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
        // Only ever forwards within a run. Compressing and uploading overlap,
        // so a phase derived from what is happening right now would flip back
        // to "optimising" every time a file finished climbing out.
        setPhase("uploading");
        await send(item, prepared, fingerprint, uploaderName);
      });

      update(item.key, { status: "done", progress: 100 });

      /*
       * Per photograph, not per batch. This used to fire once, after the last
       * file in the pick had landed, so a guest sending twenty photographs
       * watched a wall that did not change for two minutes and then changed
       * all at once - which reads exactly like an upload that is not working.
       * The gallery collapses a burst of these into one request.
       */
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

  /**
   * Runs a set of items through both gates and reports what survived.
   *
   * Everything is inside the try, including the two lines that read the
   * fingerprint and the saved name. They look incapable of failing and are not:
   * they touch `crypto` and `localStorage`, both of which throw outright in
   * some browsers. Outside the try that left `busy` stuck on for good - the
   * button disabled, the bar at zero, no message - which is the worst way for
   * an upload to fail, because the guest cannot even tell that it has.
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

      const succeeded = results.filter(Boolean).length;
      setCompleted((prev) => prev + succeeded);
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

  // One line, in the guest's terms. "Compressing" and "presigning" are our
  // words for our problems.
  const one = batch.length === 1;
  const working =
    phase === "preparing"
      ? one
        ? "Optimising your photo"
        : "Optimising your photos"
      : one
        ? "Uploading your photo"
        : "Uploading your photos";

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
        label={
          busy
            ? phase === "preparing"
              ? "Optimising…"
              : "Uploading…"
            : "Add your photos"
        }
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
        {/* The whole batch as one line. While the photos are being re-encoded
            there is no number to show - the bar drifts instead of sitting at
            zero looking stuck - and it starts filling once bytes are actually
            moving. */}
        {busy && batch.length > 0 && (
          <div className="mt-6">
            <ProgressBar
              percent={overall}
              indeterminate={phase === "preparing"}
            />
            {/* Spoken by the live region below instead, so the count does not
                get read out again on every photo that lands. */}
            <div
              aria-hidden
              className="mt-3 flex items-center gap-3 text-[0.9375rem]"
            >
              <span className="min-w-0 flex-1 truncate">{working}…</span>
              <span className="shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-mist">
                {phase === "preparing"
                  ? `${batch.length} ${batch.length === 1 ? "photo" : "photos"}`
                  : `${sent} of ${batch.length}`}
              </span>
            </div>
          </div>
        )}

        {/* Always mounted, and holding the phase only. A live region that
            appears at the same moment as its text is announced by some screen
            readers and missed by others; one that changes from empty to full is
            announced by all of them. */}
        <p className="sr-only" aria-live="polite">
          {busy ? working : ""}
        </p>

        {/* A partial failure used to show a thank-you and nothing else, so a
            guest had no way of knowing three of their ten were missing and no
            way to send them again without hunting through a camera roll. This
            is the one place a filename earns its keep: "one did not make it"
            is useless if the guest cannot tell which one. */}
        {failed.length > 0 && !busy && (
          <div className="mt-5 note p-4">
            <p className="text-[0.9375rem] font-semibold">
              {failed.length === 1
                ? "One did not make it."
                : `${failed.length} did not make it.`}
            </p>
            <ul className="mt-2 space-y-2">
              {failed.map((item) => (
                <li key={item.key} className="text-[0.9375rem]">
                  <span className="flex items-center gap-2.5">
                    <Hole size={11} className="opacity-40" />
                    <span className="min-w-0 flex-1 truncate">
                      {item.file.name}
                    </span>
                  </span>
                  <span className="mt-0.5 block pl-[1.4375rem] text-ash">
                    {item.error ?? "The connection dropped."}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              size="md"
              variant="secondary"
              onClick={retryFailed}
              className="mt-3"
            >
              {failed.length === 1 ? "Try again" : `Try ${failed.length} again`}
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
