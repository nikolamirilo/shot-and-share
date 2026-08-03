"use client";

import { useState, useTransition } from "react";

import { deleteEvent, restoreEvent } from "@/app/dashboard/actions";
import { Button } from "@/components/ui";
import type { EventRow } from "@/lib/db/types";
import { HARD_DELETE_GRACE_DAYS } from "@/lib/tiers";
import { daysUntil } from "@/lib/format";

/**
 * Deleting is the one action in this product that cannot be undone, so it asks
 * the host to type the event name rather than clicking a red button twice.
 */
export function DangerZone({ event }: { event: EventRow }) {
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const graceLeft =
    event.status === "expired" && event.deleted_at
      ? HARD_DELETE_GRACE_DAYS + (daysUntil(event.deleted_at) ?? 0)
      : null;

  function remove() {
    startTransition(async () => {
      const result = await deleteEvent(event.id);
      if (result?.error) setError(result.error);
    });
  }

  function restore() {
    startTransition(async () => {
      const result = await restoreEvent(event.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <section className="rounded-[1.25rem] border-2 border-dashed border-rind bg-cream/70 p-6">
      <h2 className="text-h3">Ending things</h2>

      {event.status === "expired" && (
        <div className="mt-4 rounded-xl border-2 border-pepper bg-butter p-4">
          <p className="text-[0.9375rem] leading-relaxed">
            This event is paused. Nothing has been deleted
            {graceLeft !== null && graceLeft > 0
              ? `, and nothing will be for about ${graceLeft} more days`
              : ""}
            .
          </p>
          <Button
            onClick={restore}
            size="sm"
            disabled={pending}
            className="mt-3"
          >
            {pending ? "Restoring…" : "Restore this event"}
          </Button>
        </div>
      )}

      <p className="mt-5 text-[0.9375rem] leading-relaxed text-crust">
        Deleting removes the event, every photo in it, and the share link
        immediately. There is no grace period on this one, because you asked for
        it directly. Type the event name to confirm.
      </p>

      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={event.name}
        aria-label={`Type "${event.name}" to confirm deletion`}
        className="mt-4 w-full rounded-xl border-2 border-pepper bg-butter px-3.5 py-2.5 font-mono text-[0.9375rem]"
      />

      <Button
        onClick={remove}
        variant="secondary"
        disabled={pending || confirmText.trim() !== event.name}
        className="mt-3"
      >
        {pending ? "Deleting…" : "Delete this event and everything in it"}
      </Button>

      {error && (
        <p className="mt-4 rounded-xl border-2 border-pepper bg-butter p-3 text-[0.9375rem]">
          {error}
        </p>
      )}
    </section>
  );
}
