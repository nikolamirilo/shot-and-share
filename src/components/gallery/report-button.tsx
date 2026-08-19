"use client";

import { useState } from "react";
import { MdOutlineFlag } from "react-icons/md";

import { Button } from "@/components/ui";

/**
 * The report button a guest can reach from inside the gallery.
 *
 * An acceptable use policy that promises a takedown route is worth nothing if
 * the only route is an email address a guest at a party will never type. This
 * is the route: two taps, no account, and the photograph is off the wall before
 * the sheet closes.
 *
 * The reasons are a short list rather than a text box on purpose. A free-text
 * field at a wedding produces jokes, and the host needs to know which of four
 * things happened, not read a paragraph.
 */

const REASONS: Array<{ id: string; label: string }> = [
  { id: "someone_in_it", label: "Someone in it does not want it shared" },
  { id: "not_allowed", label: "It should not be here at all" },
  { id: "mistake", label: "It was uploaded by mistake" },
  { id: "other", label: "Something else" },
];

export function ReportButton({
  token,
  mediaId,
  onReported,
}: {
  token: string;
  mediaId: string;
  /** The wall drops the photo and the lightbox closes behind it. */
  onReported: () => void;
}) {
  const [open, setOpen] = useState(false);
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

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="onDark" size="sm">
        <MdOutlineFlag aria-hidden className="shrink-0 text-[1.25em]" />
        Report
      </Button>
    );
  }

  return (
    /* Sits in the row rather than over the photo: a guest reporting something
       usually wants to keep looking at it while they choose, and a modal on top
       of the picture takes that away. */
    <div className="w-full rounded-[1.25rem] bg-chalk p-4 text-left text-ink">
      <p className="text-label font-semibold">Why are you reporting this?</p>
      <p className="mt-1 text-small text-ash">
        It comes off the gallery straight away and the host is told.
      </p>

      <ul className="mt-3 space-y-2">
        {REASONS.map((reason) => (
          <li key={reason.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => send(reason.id)}
              className="w-full rounded-xl bg-linen px-3.5 py-3 text-left text-small leading-tight hover:bg-blush disabled:opacity-45"
            >
              {reason.label}
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-3 text-small font-semibold text-ink">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={pending}
        className="mt-3 text-small text-ash underline underline-offset-2 disabled:opacity-45"
      >
        Never mind
      </button>
    </div>
  );
}
