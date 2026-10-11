"use client";

import { DOWNLOAD_BATCH } from "@/constants/gallery";

import { useCallback, useRef, useState } from "react";

async function downloadZips(
  token: string,
  ids: string[],
  link: HTMLAnchorElement | null,
  name: string,
) {
  const batches: string[][] = [];
  for (let at = 0; at < ids.length; at += DOWNLOAD_BATCH) {
    batches.push(ids.slice(at, at + DOWNLOAD_BATCH));
  }
  for (const [index, batch] of batches.entries()) {
    const res = await fetch("/api/photos/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ids: batch }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error?.message ?? "Could not prepare the download.");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (link) {
      link.href = url;
      link.download =
        batches.length > 1
          ? `${name}-${index + 1}-of-${batches.length}.zip`
          : `${name}.zip`;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function useZipDownload(token: string) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    async (ids: string[], name: string) => {
      if (ids.length === 0) return;
      setPending(true);
      setError(null);
      try {
        await downloadZips(token, ids, linkRef.current, name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not download.");
        console.error(err);
      } finally {
        setPending(false);
      }
    },
    [token],
  );

  const clearError = useCallback(() => setError(null), []);

  return { linkRef, pending, error, save, clearError };
}
