"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

/**
 * A short confirmation, over the page rather than in it.
 *
 * What it is for: the answer to something the host just pressed, where the
 * answer is "yes, that worked" and nothing else. Anything the host has to act
 * on - a failed save, a missing cover photo - stays on the page as an Alert,
 * because a message that takes itself away is no use to somebody who has to do
 * something about it.
 *
 * The live region is mounted whether or not anything is in it: a screen reader
 * announces text *inserted into* a region it is already watching, and one that
 * appears with its message already inside it is often read as nothing at all.
 */
export function Toast({
  open,
  onClose,
  duration = 4500,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  /** How long it sits there before taking itself away. */
  duration?: number;
  children: ReactNode;
  className?: string;
}) {
  // The caller passes a fresh closure on every render. Held in a ref so the
  // timer below is started by the message appearing rather than restarted by
  // every unrelated keystroke on the page.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => close.current(), duration);
    return () => clearTimeout(timer);
  }, [open, duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="over-bottom-bar pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4"
    >
      {open && (
        <div
          className={cx(
            "toast-in pointer-events-auto flex max-w-[min(28rem,100%)] items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-small font-semibold text-chalk shadow-lg",
            className,
          )}
        >
          <span className="min-w-0">{children}</span>
          <button
            type="button"
            onClick={onClose}
            /* A toast that leaves on its own still needs a way out: it lands
               over the bottom of the page, which on a phone is where the next
               thing to press usually is. */
            aria-label="Dismiss"
            className="-mr-1 shrink-0 rounded-full px-2 py-1 text-chalk/70 transition-colors hover:text-chalk"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
