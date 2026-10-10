"use client";

import { useCallback, useRef, useState } from "react";

/** What the download route takes in one ZIP. Bigger lists become several. */
const DOWNLOAD_BATCH = 100;

/**
 * Save a ZIP of these ids through the download route. One ZIP per hundred,
 * which is the route's ceiling, so a long shortlist still downloads whole.
 */
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

/**
 * Downloading a set of photographs as ZIPs.
 *
 * One of these for the whole wall: the favourites button and the selection bar
 * are never on screen together, so they share the pending flag and the message
 * rather than keeping two of each.
 *
 * `linkRef` belongs on an anchor the caller keeps mounted - that is what the
 * save dialog hangs off, and it is the same one every download.
 */
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
