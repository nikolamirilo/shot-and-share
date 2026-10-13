"use client";

import { MdOutlineTouchApp } from "react-icons/md";

import { Button } from "@/components/ui";

/**
 * Plays the guest flow on the hero's phone rather than sending the visitor to
 * another page. The phone listens for the event; this button only asks.
 */
export function TryGuestButton() {
  return (
    <Button
      type="button"
      size="lg"
      variant="secondary"
      className="w-full sm:w-auto"
      onClick={() => window.dispatchEvent(new Event("try-guest"))}
    >
      <MdOutlineTouchApp aria-hidden className="shrink-0 text-[1.25em]" />
      Try it as a guest
    </Button>
  );
}
