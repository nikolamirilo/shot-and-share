"use client";

import { useState } from "react";
import { MdOutlineFlag } from "react-icons/md";

import { GLASS_DENSE, GLASS_QUIET, cx } from "@/components/ui";

const REASONS: Array<{ id: string; label: string }> = [
  { id: "someone_in_it", label: "Someone in it does not want it shared" },
  { id: "not_allowed", label: "It should not be here at all" },
  { id: "mistake", label: "It was uploaded by mistake" },
  { id: "other", label: "Something else" },
];

export function ReportButton({
  token,
  mediaId,
  className,
  labelClassName,
  onReported,
  onOpenChange,
}: {
  token: string;
  mediaId: string;
  className?: string;
  labelClassName?: string;
  onReported: () => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);

  function setOpen(next: boolean) {
    setOpenState(next);
    onOpenChange?.(next);
  }
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(reason: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/guest/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, mediaId, reason }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message ?? "That did not send.");
      }
      setOpen(false);
      onReported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not send.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cx(className, open && "bg-scrim-ink/10")}
      >
        <MdOutlineFlag aria-hidden className="shrink-0 text-[1.25em]" />
        <span className={labelClassName}>Report</span>
      </button>

      {open && (
        <div
          className={cx(
            "absolute bottom-full left-1/2 mb-3 w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-[1.25rem] p-4 text-left",
            GLASS_DENSE,
          )}
        >
          <p className="text-label font-semibold">
            Why are you reporting this?
          </p>
          <p className={cx("mt-1 text-small", GLASS_QUIET)}>
            It comes off the gallery straight away and the host is told.
          </p>

          <ul className="mt-3 space-y-2">
            {REASONS.map((reason) => (
              <li key={reason.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => send(reason.id)}
                  className="w-full rounded-xl bg-scrim-ink/8 px-3.5 py-3 text-left text-small leading-tight transition-colors hover:bg-scrim-ink/15 disabled:opacity-45"
                >
                  {reason.label}
                </button>
              </li>
            ))}
          </ul>

          {error && (
            <p role="alert" className="mt-3 text-small font-semibold">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className={cx(
              "mt-3 text-small underline underline-offset-2 disabled:opacity-45",
              GLASS_QUIET,
            )}
          >
            Never mind
          </button>
        </div>
      )}
    </>
  );
}
