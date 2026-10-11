"use client";

import { MdOutlineRefresh } from "react-icons/md";

import { Button, Hole, ProgressBar } from "@/components/ui";
import { UploadPanel } from "@/components/upload/UploadPanel";
import { useUploadQueue } from "@/hooks/upload/useUploadQueue";
import type { UploadVariant } from "@/lib/appearance/variants";
import { HIDDEN_FILE_INPUT } from "@/constants/upload";
import { useAccept } from "@/hooks/upload/useAccept";
import { useFilePicker } from "@/hooks/upload/useFilePicker";
import { useInAppBrowser } from "@/hooks/upload/useInAppBrowser";
import { formatBytes } from "@/utils/format";
import {
  PREPARING,
  UPLOADING,
  countLabel,
  uploadWording,
} from "@/lib/media";

export function Uploader({
  token,
  variant,
  allowVideo,
  maxFileBytes,
  remainingBytes,
  onUploaded,
}: {
  token: string;
  variant: UploadVariant;
  allowVideo: boolean;
  maxFileBytes: number;
  remainingBytes: number;
  onUploaded: () => void;
}) {
  const queue = useUploadQueue({
    token,
    maxFileBytes,
    remainingBytes,
    onUploaded,
  });

  const handleFiles = (files: File[]) => {
    void queue.addFiles(files);
  };
  const library = useFilePicker(handleFiles);
  const camera = useFilePicker(handleFiles);

  const inApp = useInAppBrowser();

  const working = queue.phase === "preparing" ? PREPARING : UPLOADING;

  const wording = uploadWording({ video: allowVideo, maxFileBytes });
  const accept = useAccept(allowVideo);

  const refused = [...queue.failed, ...queue.skipped];

  return (
    <>
      <input
        ref={library.inputRef}
        type="file"
        multiple
        accept={accept}
        className={HIDDEN_FILE_INPUT}
        tabIndex={-1}
        aria-hidden
        id="guest-files"
      />
      {variant === "split" && (
        <input
          ref={camera.inputRef}
          type="file"
          accept={accept}
          capture="environment"
          className={HIDDEN_FILE_INPUT}
          tabIndex={-1}
          aria-hidden
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
        pickFor="guest-files"
        captureFor={variant === "split" ? "guest-camera" : undefined}
        onPick={library.open}
        onCapture={camera.open}
        onDropFiles={(files) => handleFiles(Array.from(files))}
      >
        {queue.busy && queue.batch.length > 0 && (
          <div className="mt-6">
            <ProgressBar percent={queue.overall} />
            <div
              aria-hidden
              className="mt-3 flex items-center gap-3 text-[0.9375rem]"
            >
              <span className="min-w-0 flex-1 truncate">{working}…</span>
              <span className="shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-mist">
                {queue.sent === 0 && queue.phase === "preparing"
                  ? countLabel(queue.batch.length)
                  : `${queue.sent} of ${queue.batch.length}`}
              </span>
            </div>
            {queue.picked > queue.batch.length && (
              <p className="mt-2 text-[0.8125rem] text-ash">
                Your phone handed over {queue.picked}; {queue.batch.length} are
                on their way.
              </p>
            )}
          </div>
        )}

        <p className="sr-only" aria-live="polite">
          {queue.busy ? working : ""}
        </p>

        {inApp && !queue.busy && (
          <p className="mt-5 note p-4 text-[0.9375rem]">
            You are in {inApp}&rsquo;s browser, which can only pass on one photo
            at a time. To send several at once, open this page in Safari or
            Chrome - tap the menu at the corner of the screen and choose
            &ldquo;Open in browser&rdquo;.
          </p>
        )}

        {queue.notice && (
          <p className="mt-5 note p-4 text-[0.9375rem]">{queue.notice}</p>
        )}

        {refused.length > 0 && !queue.busy && (
          <div className="mt-5 note p-4">
            <p className="text-[0.9375rem] font-semibold">
              {refused.length === 1
                ? "One did not make it."
                : `${refused.length} did not make it.`}
            </p>
            <ul className="mt-2 space-y-2">
              {refused.map((item) => (
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
            {queue.upgradeHint && (
              <p className="mt-2 text-[0.9375rem] text-ash">
                The host needs to make more room. Let them know - they can raise
                the limit from their phone in under a minute.
              </p>
            )}
            {queue.failed.length > 0 && (
              <Button
                size="md"
                variant="secondary"
                onClick={queue.retryFailed}
                className="mt-3"
              >
                <MdOutlineRefresh aria-hidden className="shrink-0 text-[1.25em]" />
                {queue.failed.length === 1
                  ? "Try again"
                  : `Try ${queue.failed.length} again`}
              </Button>
            )}
          </div>
        )}

        {queue.completed > 0 && queue.inFlight === 0 && !queue.busy && (
          <p className="mt-5 rounded-xl bg-blush shadow-sm p-4 text-center">
            <strong>Thank you.</strong>{" "}
            {queue.completed === 1
              ? "It is with the host."
              : `All ${queue.completed} are with the host.`}{" "}
            Add more any time tonight.
            {queue.held > 0 && (
              <span className="mt-2 block text-[0.9375rem] text-ash">
                {queue.held === 1 && queue.completed === 1
                  ? "The host is checking it before it goes on the wall."
                  : `${queue.held} of them are with the host to check before they go on the wall.`}
              </span>
            )}
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
          </div>
        )}
      </UploadPanel>
    </>
  );
}
