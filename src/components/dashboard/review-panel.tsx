"use client";

import Image from "next/image";
import { useState } from "react";
import { MdOutlineCheck, MdOutlineDelete, MdOutlineFlag } from "react-icons/md";

import { useServerAction } from "@/hooks/use-server-action";

import { approveMedia } from "@/lib/actions/moderation";
import { deleteMedia } from "@/lib/actions/media";
import { Alert, Badge, Button, Panel } from "@/components/ui";
import type { MediaView } from "@/lib/media-view";

/**
 * Everything waiting on the host: flagged by the automated check, held because
 * the event holds everything, or reported by a guest.
 *
 * Not drawn at all when the queue is empty, which is the normal state. A panel
 * that says "nothing to review" on every event teaches hosts to ignore it, and
 * the one evening it has something in it they will ignore that too.
 *
 * Each photograph is shown large enough to judge and paired with the reason it
 * is here. Approving is one tap. Deleting goes through the same action as any
 * other delete, so there is still only one path that removes objects from a
 * bucket.
 */
export function ReviewPanel({
  eventId,
  items,
}: {
  eventId: string;
  items: MediaView[];
}) {
  const { pending, error, run } = useServerAction();
  /** Which row is being acted on, so only its own buttons go quiet. */
  const [working, setWorking] = useState<string | null>(null);

  if (items.length === 0) return null;

  const reported = items.filter((item) => item.review?.state === "reported");

  function act(id: string, what: "approve" | "delete") {
    setWorking(id);
    run(
      () =>
        what === "approve"
          ? approveMedia(eventId, [id])
          : deleteMedia(eventId, [id]),
      {
        confirm:
          what === "delete"
            ? "Delete this photo? This cannot be undone."
            : undefined,
      },
    );
  }

  return (
    <Panel title={`Waiting on you (${items.length})`}>
      <p className="mt-1 text-small text-ash">
        {reported.length > 0
          ? "A guest reported something, so it is already hidden. Nobody else can see anything on this list."
          : "These are hidden from the gallery until you say otherwise. Nobody else can see them."}
      </p>

      {error && (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      )}

      <ul className="mt-4 space-y-4">
        {items.map((item) => {
          const busy = pending && working === item.id;
          return (
            <li
              key={item.id}
              className="flex flex-col gap-4 rounded-[1.25rem] bg-linen p-3 xs:flex-row sm:p-4"
            >
              <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-xl bg-ink/10 xs:w-32 sm:w-40">
                {item.previewUrl ? (
                  <Image
                    src={item.previewUrl}
                    alt=""
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <Reason item={item} />

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => act(item.id, "approve")}
                  >
                    <MdOutlineCheck aria-hidden className="shrink-0 text-[1.25em]" />
                    {busy ? "Working…" : "Put it on the wall"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => act(item.id, "delete")}
                  >
                    <MdOutlineDelete aria-hidden className="shrink-0 text-[1.25em]" />
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/**
 * Why this photograph is here, in the host's terms rather than the provider's.
 *
 * The raw category names are shown too, because a host arguing with a false
 * positive deserves to see what actually fired rather than being told the
 * computer said no.
 */
function Reason({ item }: { item: MediaView }) {
  const review = item.review;
  if (!review) return null;

  if (review.state === "reported") {
    return (
      <div>
        <Badge tone="dark">
          <MdOutlineFlag aria-hidden className="shrink-0" />
          Reported by a guest
        </Badge>
        <p className="mt-2 text-small text-ash">
          {review.reports === 1
            ? "One guest reported this and it came off the gallery straight away."
            : `${review.reports} guests reported this and it came off the gallery straight away.`}{" "}
          Put it back if they were mistaken.
        </p>
      </div>
    );
  }

  if (review.labels.length === 0) {
    return (
      <div>
        <Badge tone="outline">Waiting for you</Badge>
        <p className="mt-2 text-small text-ash">
          This event holds every upload until you approve it. Nothing is wrong
          with this photo.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Badge tone="outline">Flagged by the automatic check</Badge>
      <p className="mt-2 text-small text-ash">
        The check thought it saw{" "}
        <strong>{review.labels.slice(0, 3).join(", ").toLowerCase()}</strong>.
        It is often wrong. Have a look and decide.
      </p>
    </div>
  );
}
