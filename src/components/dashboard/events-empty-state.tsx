import { MdOutlineAddCircleOutline } from "react-icons/md";

import { ButtonLink } from "@/components/ui";

/** Empty states are invitations, not apologies. */
export function EventsEmptyState() {
  return (
    <div className="mt-8 max-w-xl">
      <p className="text-lead text-ash">
        Make an event, print the code, and send the link to one friend. Watch a
        photo arrive before you decide anything else.
      </p>
      <ButtonLink
        href="/dashboard/events/new"
        size="lg"
        className="mt-7 w-full sm:w-auto"
      >
        <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
        Create an event
      </ButtonLink>
    </div>
  );
}
