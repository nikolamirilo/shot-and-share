"use client";

import { useRef, useState } from "react";

import { Button, Hole, ProgressBar, cx } from "@/components/ui";
import {
  getFingerprint,
  getSavedName,
  makeThumbnail,
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

type ItemStatus = "preparing" | "uploading" | "done" | "failed";

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
    original: PresignedUpload;
    thumb: PresignedUpload | null;
  }>;
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
      // 1. Shrink locally. The phone that took the photo does the work.
      const thumbs = await Promise.all(next.map((i) => makeThumbnail(i.file)));

      // 2. Ask for URLs. The quota is checked before a single one is issued.
      const fingerprint = getFingerprint();
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          fingerprint,
          uploaderName: name.trim() || null,
          files: next.map((item, i) => ({
            size: item.file.size,
            type: item.file.type,
            thumbSize: thumbs[i]?.blob.size ?? 0,
          })),
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

      // 3. Straight to storage, three at a time.
      const results: Array<{
        mediaId: string;
        width: number | null;
        height: number | null;
        thumbUploaded: boolean;
        failed: boolean;
      }> = uploads.map((u) => ({
        mediaId: u.mediaId,
        width: null,
        height: null,
        thumbUploaded: false,
        failed: false,
      }));

      await pool(next, 3, async (item, index) => {
        const upload = uploads[index];
        const thumb = thumbs[index];
        update(item.key, { status: "uploading" });

        try {
          await uploadToPresigned(upload.original, item.file, (fraction) =>
            update(item.key, { progress: Math.round(fraction * 100) }),
          );

          if (thumb && upload.thumb) {
            try {
              await uploadToPresigned(upload.thumb, thumb.blob);
              results[index].thumbUploaded = true;
              results[index].width = thumb.width;
              results[index].height = thumb.height;
            } catch {
              // A missing thumbnail is a cosmetic problem, not a lost photo.
              results[index].thumbUploaded = false;
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
        {busy ? `Uploading… ${overall}%` : "Add your photos"}
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
          Your name — optional
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
                        : "preparing"}
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
        </p>
      )}

      {error && (
        <div className="mt-5 rounded-xl border-2 border-pepper bg-butter p-4">
          <p className="text-[0.9375rem] font-semibold">{error}</p>
          {upgradeHint && (
            <p className="mt-1.5 text-[0.9375rem] text-crust">
              The host needs to make more room. Let them know — they can raise
              the limit from their phone in under a minute.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
