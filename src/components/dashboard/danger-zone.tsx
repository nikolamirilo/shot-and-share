"use client";

import { useState } from "react";

import { useServerAction } from "@/hooks/use-server-action";

import { deleteEvent, restoreEvent } from "@/lib/actions/lifecycle";
import { Alert, Button, cx, inputClass } from "@/components/ui";
import type { EventRow } from "@/lib/db/types";
import { HARD_DELETE_GRACE_DAYS } from "@/lib/tiers";
import { daysUntil } from "@/lib/format";

/**
 * Deleting is the one action in this product that cannot be undone, so it asks
 * the host to type the event name rather than clicking a red button twice.
 */
export function DangerZone({ event }: { event: EventRow }) {
  const [confirmText, setConfirmText] = useState("");
  const { pending, error, run } = useServerAction();

  const graceLeft =
    event.status === "expired" && event.deleted_at
      ? HARD_DELETE_GRACE_DAYS + (daysUntil(event.deleted_at) ?? 0)
      : null;

  function remove() {
    run(() => deleteEvent(event.id));
  }

  function restore() {
    run(() => restoreEvent(event.id));
  }

  return (
    <section className="inset-shadow-well rounded-[1.25rem] bg-mist/8 p-5 sm:p-6">
      <h2 className="text-h3">Ending things</h2>

      {event.status === "expired" && (
        <div className="mt-4 note p-4">
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
            className="mt-3 w-full sm:w-auto"
          >
            {pending ? "Restoring…" : "Restore this event"}
          </Button>
        </div>
      )}

      <p className="mt-5 max-w-prose text-[0.9375rem] leading-relaxed text-ash">
        Deleting removes the event, every photo in it, and the share link
        immediately. There is no grace period on this one, because you asked for
        it directly. Type the event name to confirm.
      </p>

      {/* 17px rather than 15: Safari zooms the page in on a focused field
          under 16px, and this is the one field where what you typed has to be
          readable while you type it. */}
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={event.name}
        aria-label={`Type "${event.name}" to confirm deletion`}
        className={cx(inputClass, "mt-4 font-mono sm:max-w-sm")}
      />

      <Button
        onClick={remove}
        variant="secondary"
        disabled={pending || confirmText.trim() !== event.name}
        className="mt-3 w-full sm:w-auto"
      >
        {pending ? "Deleting…" : "Delete this event and everything in it"}
      </Button>

      {error && <Alert className="mt-4">{error}</Alert>}
    </section>
  );
}
