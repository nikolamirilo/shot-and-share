"use client";

import { useState } from "react";
import { MdOutlineDeleteForever, MdOutlineRestore } from "react-icons/md";

import { useServerAction } from "@/hooks/useServerAction";

import { deleteEvent, restoreEvent } from "@/lib/actions/lifecycle";
import { Alert, Button, cx, inputClass } from "@/components/ui";
import { type EventRow } from "@/types/db";
import { HARD_DELETE_GRACE_DAYS } from "@/lib/tiers";
import { daysUntil } from "@/utils/format";

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
            <MdOutlineRestore aria-hidden className="shrink-0 text-[1.25em]" />
            {pending ? "Restoring…" : "Restore this event"}
          </Button>
        </div>
      )}

      <p className="mt-5 max-w-prose text-[0.9375rem] leading-relaxed text-ash">
        Deleting removes the event, every photo in it, and the share link
        immediately. There is no grace period on this one, because you asked for
        it directly. To confirm, type{" "}
        <strong className="break-words font-mono text-ink">{event.name}</strong>{" "}
        below.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* 17px, not 15: Safari zooms in on a focused field under 16px. */}
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Event name"
          aria-label={`Type "${event.name}" to confirm deletion`}
          className={cx(inputClass, "font-mono sm:w-64 sm:min-w-0")}
        />

        <Button
          onClick={remove}
          variant="secondary"
          disabled={pending || confirmText.trim() !== event.name}
          className="w-full sm:w-auto sm:shrink-0"
        >
          <MdOutlineDeleteForever
            aria-hidden
            className="shrink-0 text-[1.25em]"
          />
          {pending ? "Deleting…" : "Delete this event and everything in it"}
        </Button>
      </div>

      {error && <Alert className="mt-4">{error}</Alert>}
    </section>
  );
}
