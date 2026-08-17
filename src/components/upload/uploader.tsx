"use client";

import { useRef } from "react";

import { Button, Hole, ProgressBar } from "@/components/ui";
import { UploadPanel } from "@/components/upload/upload-panel";
import { useUploadQueue } from "@/components/upload/use-upload-queue";
import type { UploadVariant } from "@/lib/appearance/variants";
import { formatBytes } from "@/lib/format";
import {
  ACCEPT_ATTRIBUTE_ALL,
  ACCEPT_ATTRIBUTE_PHOTO,
  PREPARING,
  UPLOADING,
  countLabel,
  uploadWording,
} from "@/lib/media";

/**
 * The guest side is one screen and it stays that way.
 *
 * Every extra field here is a guest who does not upload, and a guest who opens
 * the link without uploading is the clearest signal that the product is broken.
 * So: no sign-in, no explanation, one big button, and the name field is
 * optional and remembered.
 *
 * The queue itself is in useUploadQueue. This is what it looks like.
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

  const queue = useUploadQueue({
    token,
    maxFileBytes,
    remainingBytes,
    onUploaded,
  });

  async function handleFiles(files: FileList | null) {
    await queue.addFiles(files);
    // Cleared so picking the same file twice still fires a change event.
    if (inputRef.current) inputRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  // One line, in the guest's terms. "Compressing" and "presigning" are our
  // words for our problems - and neither is the noun, because one tap can put
  // four photos and a clip in the same queue.
  const working = queue.phase === "preparing" ? PREPARING : UPLOADING;

  const wording = uploadWording(allowVideo);
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
        busy={queue.busy}
        label={queue.busy ? `${working}…` : wording.action}
        captureLabel={wording.capture}
        chooseLabel={wording.choose}
        hint={`${wording.hint} ${formatBytes(remainingBytes)} of room left.`}
        name={queue.name}
        onNameChange={queue.setName}
        onPick={() => inputRef.current?.click()}
        onCapture={() => cameraRef.current?.click()}
        onDropFiles={handleFiles}
      >
        {/* The whole batch as one line. While the batch is being re-encoded
            there is no number to show - the bar drifts instead of sitting at
            zero looking stuck - and it starts filling once bytes are moving. */}
        {queue.busy && queue.batch.length > 0 && (
          <div className="mt-6">
            <ProgressBar
              percent={queue.overall}
              indeterminate={queue.phase === "preparing"}
            />
            {/* Spoken by the live region below instead, so the count does not
                get read out again on every file that lands. */}
            <div
              aria-hidden
              className="mt-3 flex items-center gap-3 text-[0.9375rem]"
            >
              <span className="min-w-0 flex-1 truncate">{working}…</span>
              <span className="shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-mist">
                {queue.phase === "preparing"
                  ? countLabel(queue.batch.length)
                  : `${queue.sent} of ${queue.batch.length}`}
              </span>
            </div>
          </div>
        )}

        {/* Always mounted, and holding the phase only. A live region that
            appears at the same moment as its text is announced by some screen
            readers and missed by others; one that changes from empty to full is
            announced by all of them. */}
        <p className="sr-only" aria-live="polite">
          {queue.busy ? working : ""}
        </p>

        {/* The one place a filename earns its keep: "one did not make it" is
            useless if the guest cannot tell which one. */}
        {queue.failed.length > 0 && !queue.busy && (
          <div className="mt-5 note p-4">
            <p className="text-[0.9375rem] font-semibold">
              {queue.failed.length === 1
                ? "One did not make it."
                : `${queue.failed.length} did not make it.`}
            </p>
            <ul className="mt-2 space-y-2">
              {queue.failed.map((item) => (
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
              onClick={queue.retryFailed}
              className="mt-3"
            >
              {queue.failed.length === 1
                ? "Try again"
                : `Try ${queue.failed.length} again`}
            </Button>
          </div>
        )}

        {queue.completed > 0 && queue.inFlight === 0 && !queue.busy && (
          <p className="mt-5 rounded-xl bg-blush shadow-sm p-4 text-center">
            <strong>Thank you.</strong>{" "}
            {queue.completed === 1
              ? "It is with the host."
              : `All ${queue.completed} are with the host.`}{" "}
            Add more any time tonight.
            {queue.saved.from > queue.saved.to && queue.saved.to > 0 && (
              <span className="mt-1 block font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ash">
                sent {formatBytes(queue.saved.to)} instead of{" "}
                {formatBytes(queue.saved.from)}
              </span>
            )}
          </p>
        )}

        {queue.error && (
          <div className="mt-5 note p-4">
            <p className="text-[0.9375rem] font-semibold">{queue.error}</p>
            {queue.upgradeHint && (
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
