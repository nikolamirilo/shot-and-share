"use client";

import { useState } from "react";
import { MdOutlineDeleteForever, MdOutlineRestore } from "react-icons/md";

import { useServerAction } from "@/hooks/useServerAction";

import { deleteEvent, restoreEvent } from "@/lib/actions/lifecycle";
import { Alert, Button, ConfirmDialog } from "@/components/ui";
import { type EventRow } from "@/types/db";
import { HARD_DELETE_GRACE_DAYS } from "@/lib/tiers";
import { daysUntil } from "@/utils/format";

export function DangerZone({ event }: { event: EventRow }) {
  const [asking, setAsking] = useState(false);
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
      <h2 className="text-h3">Delete event</h2>

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

      <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-ash">
        Removes the event, every photo in it, and the share link.
      </p>

      <Button
        onClick={() => setAsking(true)}
        variant="secondary"
        disabled={pending}
        className="mt-4 w-full sm:w-auto"
      >
        <MdOutlineDeleteForever aria-hidden className="shrink-0 text-[1.25em]" />
        Delete event
      </Button>

      {error && <Alert className="mt-4">{error}</Alert>}

      {asking && (
        <ConfirmDialog
          title={`Delete "${event.name}"?`}
          body="Every photo and the share link go with it. This cannot be undone."
          pending={pending}
          onConfirm={remove}
          onCancel={() => setAsking(false)}
        />
      )}
    </section>
  );
}
