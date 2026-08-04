"use client";

import { useRef, useState } from "react";

import { Button, Hole, ProgressBar, cx } from "@/components/ui";
import { makeImageRenditions, probeVideo } from "@/lib/client/codec";
import {
  getFingerprint,
  getSavedName,
  pool,
  saveName,
  uploadToPresigned,
} from "@/lib/client/upload";
import { formatBytes } from "@/lib/format";
import {
  ACCEPT_ATTRIBUTE_ALL,
  ACCEPT_ATTRIBUTE_PHOTO,
  MAX_FILES_PER_REQUEST,
} from "@/lib/media";
import type { PresignedUpload } from "@/lib/storage/types";

type ItemStatus = "preparing" | "prepared" | "uploading" | "done" | "failed";

interface Item {
  key: string;
  file: File;
  status: ItemStatus;
  progress: number;
  error?: string;
}

interface PresignResponse {
  uploads: Array<{
    mediaId: string;
    /** "display" means the server wants the optimised copy as the archive. */
    originalSource: "file" | "display";
    original: PresignedUpload;
    display: PresignedUpload | null;
    thumb: PresignedUpload | null;
    poster: PresignedUpload | null;
  }>;
}

/** Everything the browser managed to produce for one selected file. */
interface Prepared {
  file: File;
  display: Blob | null;
  thumb: Blob | null;
  poster: Blob | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  durationSeconds: number | null;
  needsServer: boolean;
  descriptor: Record<string, unknown>;
}

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
  allowVideo,
  maxFileBytes,
  remainingBytes,
  onUploaded,
}: {
  token: string;
  allowVideo: boolean;
  maxFileBytes: number;
  remainingBytes: number;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeHint, setUpgradeHint] = useState(false);
  const [name, setName] = useState<string>(() =>
    typeof window === "undefined" ? "" : getSavedName(),
  );
  const [completed, setCompleted] = useState(0);
  const [stage, setStage] = useState<"Preparing" | "Uploading">("Preparing");
  const [saved, setSaved] = useState({ from: 0, to: 0 });

  function update(key: string, patch: Partial<Item>) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList).slice(0, MAX_FILES_PER_REQUEST);
    setError(null);
    setUpgradeHint(false);

    const oversized = files.find((f) => f.size > maxFileBytes);
    if (oversized) {
      setError(
        `“${oversized.name}” is bigger than ${formatBytes(maxFileBytes, 0)}, which is the most we can take in one file.`,
      );
      return;
    }

    const next: Item[] = files.map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      file,
      status: "preparing",
      progress: 0,
    }));
    setItems(next);
    setBusy(true);
    saveName(name.trim());

    try {
      // 1. Compress locally. The phone that took the photo has the pixels
      //    already decoded and the guest is looking at the screen anyway.
      setStage("Preparing");
      const prepared: Prepared[] = [];
      for (const item of next) {
        prepared.push(await prepare(item.file));
        update(item.key, { status: "prepared" });
      }

      // What the guest would have sent versus what they are about to send.
      setSaved((prev) => ({
        from: prev.from + next.reduce((sum, i) => sum + i.file.size, 0),
        to:
          prev.to +
          prepared.reduce(
            (sum, p) => sum + (p.display ? p.display.size : p.file.size),
            0,
          ),
      }));

      // 2. Ask for URLs. The quota is checked before a single one is issued,
      //    and the server decides which copies are worth storing.
      setStage("Uploading");
      const fingerprint = getFingerprint();
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          fingerprint,
          uploaderName: name.trim() || null,
          files: prepared.map((p) => p.descriptor),
        }),
      });

      const presignBody = await presignRes.json();
      if (!presignRes.ok) {
        const message =
          presignBody?.error?.message ?? "Could not start the upload.";
        setUpgradeHint(Boolean(presignBody?.error?.upgrade));
        throw new Error(message);
      }

      const { uploads } = presignBody as PresignResponse;

      const results = uploads.map((u) => ({
        mediaId: u.mediaId,
        width: null as number | null,
        height: null as number | null,
        originalUploaded: false,
        displayUploaded: false,
        thumbUploaded: false,
        posterUploaded: false,
        failed: false,
      }));

      // 3. Straight to storage, three at a time.
      await pool(next, 3, async (item, index) => {
        const upload = uploads[index];
        const source = prepared[index];
        update(item.key, { status: "uploading" });

        const archival =
          upload.originalSource === "display" && source.display
            ? source.display
            : item.file;

        try {
          await uploadToPresigned(upload.original, archival, (fraction) =>
            update(item.key, { progress: Math.round(fraction * 100) }),
          );
          results[index].originalUploaded = true;
          results[index].width = source.sourceWidth;
          results[index].height = source.sourceHeight;

          // Secondary copies are cosmetic. One failing must never cost the
          // photo, so each is attempted on its own and forgiven on its own.
          const extras: Array<[PresignedUpload | null, Blob | null, "displayUploaded" | "thumbUploaded" | "posterUploaded"]> = [
            [upload.display, source.display, "displayUploaded"],
            [upload.thumb, source.thumb, "thumbUploaded"],
            [upload.poster, source.poster, "posterUploaded"],
          ];
          for (const [presigned, blob, flag] of extras) {
            if (!presigned || !blob) continue;
            try {
              await uploadToPresigned(presigned, blob);
              results[index][flag] = true;
            } catch {
              /* the server hands the reserved bytes back on confirm */
            }
          }

          update(item.key, { status: "done", progress: 100 });
        } catch (e) {
          results[index].failed = true;
          update(item.key, {
            status: "failed",
            error: e instanceof Error ? e.message : "Upload failed.",
          });
        }
      });

      // 4. Commit. Anything that failed hands its reserved space back.
      await fetch("/api/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fingerprint, items: results }),
      });

      const succeeded = results.filter((r) => !r.failed).length;
      setCompleted((prev) => prev + succeeded);
      if (succeeded > 0) onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setItems((prev) =>
        prev.map((item) =>
          item.status === "done" ? item : { ...item, status: "failed" },
        ),
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const inFlight = items.filter((i) => i.status !== "done").length;
  const overall =
    items.length === 0
      ? 0
      : Math.round(
          items.reduce(
            (sum, i) => sum + (i.status === "done" ? 100 : i.progress),
            0,
          ) / items.length,
        );

  return (
    <section className="card mt-8 p-6">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={allowVideo ? ACCEPT_ATTRIBUTE_ALL : ACCEPT_ATTRIBUTE_PHOTO}
        onChange={(e) => handleFiles(e.target.files)}
        className="sr-only"
        id="guest-files"
      />

      <Button
        size="lg"
        className="w-full py-5 text-[1.3rem]"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? `${stage}… ${stage === "Uploading" ? `${overall}%` : ""}` : "Add your photos"}
      </Button>

      <p className="mt-3 text-center text-[0.9375rem] text-crust">
        {allowVideo
          ? `Photos and video, up to ${MAX_FILES_PER_REQUEST} at a time.`
          : `Photos, up to ${MAX_FILES_PER_REQUEST} at a time.`}{" "}
        {formatBytes(remainingBytes)} of room left.
      </p>

      <div className="mt-5">
        <label
          htmlFor="guest-name"
          className="block font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind"
        >
          Your name - optional
        </label>
        <input
          id="guest-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="So the host knows who to thank"
          className="mt-1.5 w-full rounded-xl border-2 border-pepper bg-butter px-3.5 py-2.5"
        />
      </div>

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
                    item.status === "done" && "bg-pepper",
                    item.status === "failed" && "opacity-40",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">
                  {item.file.name}
                </span>
                <span className="shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-rind">
                  {item.status === "done"
                    ? "added"
                    : item.status === "failed"
                      ? "failed"
                      : item.status === "uploading"
                        ? `${item.progress}%`
                        : item.status === "prepared"
                          ? "ready"
                          : "shrinking"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {completed > 0 && inFlight === 0 && !busy && (
        <p className="mt-5 rounded-xl border-2 border-pepper bg-gouda p-4 text-center">
          <strong>Thank you.</strong>{" "}
          {completed === 1
            ? "Your photo is with the host."
            : `All ${completed} are with the host.`}{" "}
          Add more any time tonight.
          {saved.from > saved.to && saved.to > 0 && (
            <span className="mt-1 block font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-crust">
              sent {formatBytes(saved.to)} instead of {formatBytes(saved.from)}
            </span>
          )}
        </p>
      )}

      {error && (
        <div className="mt-5 rounded-xl border-2 border-pepper bg-butter p-4">
          <p className="text-[0.9375rem] font-semibold">{error}</p>
          {upgradeHint && (
            <p className="mt-1.5 text-[0.9375rem] text-crust">
              The host needs to make more room. Let them know - they can raise
              the limit from their phone in under a minute.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Everything the browser can do for one file before it leaves the device:
 * decode it, shrink it, re-encode it into a format that opens anywhere, and -
 * for a video - pull a poster frame out of it.
 */
async function prepare(file: File): Promise<Prepared> {
  if (file.type.startsWith("video/")) {
    const probe = await probeVideo(file);
    return {
      file,
      display: null,
      thumb: null,
      poster: probe.poster?.blob ?? null,
      sourceWidth: probe.width,
      sourceHeight: probe.height,
      durationSeconds: probe.durationSeconds,
      needsServer: true,
      descriptor: {
        size: file.size,
        type: file.type,
        poster: probe.poster
          ? {
              size: probe.poster.blob.size,
              format: probe.poster.format,
              width: probe.poster.width,
              height: probe.poster.height,
            }
          : null,
        sourceWidth: probe.width,
        sourceHeight: probe.height,
        durationSeconds: probe.durationSeconds,
        needsServer: true,
      },
    };
  }

  const renditions = await makeImageRenditions(file);
  return {
    file,
    display: renditions.display?.blob ?? null,
    thumb: renditions.thumb?.blob ?? null,
    poster: null,
    sourceWidth: renditions.sourceWidth,
    sourceHeight: renditions.sourceHeight,
    durationSeconds: null,
    needsServer: renditions.needsServer,
    descriptor: {
      size: file.size,
      type: file.type,
      display: renditions.display
        ? {
            size: renditions.display.blob.size,
            format: renditions.display.format,
            width: renditions.display.width,
            height: renditions.display.height,
          }
        : null,
      thumb: renditions.thumb
        ? {
            size: renditions.thumb.blob.size,
            format: renditions.thumb.format,
            width: renditions.thumb.width,
            height: renditions.thumb.height,
          }
        : null,
      sourceWidth: renditions.sourceWidth,
      sourceHeight: renditions.sourceHeight,
      needsServer: renditions.needsServer,
    },
  };
}
