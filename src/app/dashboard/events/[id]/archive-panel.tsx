"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui";
import { formatBytes, formatDateTime } from "@/lib/format";
import { MAX_ARCHIVE_BUILDS } from "@/lib/tiers";

interface ArchiveState {
  ready: boolean;
  builds: number;
  builtAt?: string | null;
  sizeBytes?: number | null;
  url?: string;
}

/**
 * The ZIP is the single largest cost line in the whole system, so it is built
 * once, stored, and served again from the same object. Regeneration is capped
 * rather than left open, and the cap is stated plainly instead of failing
 * silently on the fourth attempt.
 */
export function ArchivePanel({
  eventId,
  photoCount,
}: {
  eventId: string;
  photoCount: number;
}) {
  const [state, setState] = useState<ArchiveState | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/archive`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && !data.error) setState(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function build() {
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/archive`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error.message);
      } else {
        setState({ ready: true, ...data });
        if (data.url) window.location.href = data.url;
      }
    } catch {
      setError("The ZIP could not be built. Try again in a minute.");
    } finally {
      setBuilding(false);
    }
  }

  const buildsLeft = MAX_ARCHIVE_BUILDS - (state?.builds ?? 0);

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-h3">Download everything</h2>

      {photoCount === 0 ? (
        <p className="mt-3 text-[0.9375rem] text-crust">
          Once photos start arriving you can take the lot as a single ZIP.
        </p>
      ) : (
        <>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-crust">
            One ZIP with all {photoCount.toLocaleString("en-GB")} files, named by
            the time they were taken. Built once and kept, so downloading it
            again is instant.
          </p>

          {state?.ready && state.builtAt && (
            <p className="mt-4 note px-3 py-2 font-mono text-[0.8125rem]">
              Last built {formatDateTime(state.builtAt)}
              {state.sizeBytes ? ` · ${formatBytes(state.sizeBytes)}` : ""}
            </p>
          )}

          {/* "Rebuild with the newest photos" is five words. Side by side on a
              phone both buttons wrap; stacked and full width they read as the
              two choices they are. */}
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
            {state?.ready && state.url && (
              <Button
                onClick={() => {
                  window.location.href = state.url!;
                }}
                className="w-full sm:w-auto"
              >
                Download the ZIP
              </Button>
            )}
            <Button
              onClick={build}
              variant={state?.ready ? "secondary" : "primary"}
              disabled={building || buildsLeft <= 0}
              className="w-full sm:w-auto"
            >
              {building
                ? "Packaging…"
                : state?.ready
                  ? "Rebuild with the newest photos"
                  : "Build the ZIP"}
            </Button>
          </div>

          <p className="mt-3 text-[0.8125rem] text-rind">
            {buildsLeft > 0
              ? `${buildsLeft} of ${MAX_ARCHIVE_BUILDS} rebuilds left. Downloading the existing ZIP does not use one.`
              : "You have used all the rebuilds for this event. The last ZIP is still downloadable."}
          </p>
        </>
      )}

      {error && (
        <p className="mt-4 note p-3 text-[0.9375rem]">
          {error}
        </p>
      )}
    </section>
  );
}
