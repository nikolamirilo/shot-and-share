"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MdClose } from "react-icons/md";

import { LogoMark } from "@/components/layout/logo";

/**
 * An optional add-on to any of the three variants: the same offer, floated up
 * once the guest has scrolled past the gallery.
 *
 * It exists because of where the visits end. A guest opens the link, uploads,
 * scrolls a little and closes the tab; whatever sits at the bottom of the page
 * is read by the minority who keep going.
 *
 * It is the house pill - paper, a shadow, blurred behind - and not a dark
 * banner, because the one thing floating over somebody's photographs should be
 * the lightest object on the page, not the heaviest. Three rules keep it
 * honest: it waits until the photographs have been seen, one tap on the cross
 * puts it away for the session, and it never covers the upload control, which
 * lives at the top of the page.
 */

const DISMISSED = "ss:invite-dismissed";

/** How far down the page the guest has to be before the pill is allowed up. */
const TRIGGER = 0.55;

export function PlatformInviteBar() {
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(true);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISSED)) return;
    } catch {
      // Private mode, or storage turned off. Showing it is the safe failure:
      // the worst case is a guest dismissing it twice.
    }
    setGone(false);

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const scrollable =
          document.documentElement.scrollHeight - window.innerHeight;
        // A page short enough not to scroll has no "past the gallery" to wait
        // for, so it comes up as soon as it is on screen.
        setShown(scrollable < 200 || window.scrollY / scrollable > TRIGGER);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  function dismiss() {
    setGone(true);
    try {
      sessionStorage.setItem(DISMISSED, "1");
    } catch {
      // Then it comes back on the next page load. Not worth a second thought.
    }
  }

  if (gone) return null;

  return (
    <div
      aria-label="Shot & Share"
      role="region"
      className={`fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-300 motion-reduce:transition-none ${
        shown ? "translate-y-0" : "translate-y-[130%]"
      }`}
    >
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-paper/92 py-2 pl-3.5 pr-2 shadow-lg backdrop-blur">
        <LogoMark className="h-6 w-auto shrink-0" />

        <p className="min-w-0 flex-1 text-label leading-snug text-ash">
          <Link
            href="/"
            target="_blank"
            rel="noopener"
            className="font-semibold text-claret underline decoration-claret/35 underline-offset-4 hover:decoration-claret"
          >
            Collect photos at your own event
          </Link>{" "}
          - free, no app.
        </p>

        {/* A cross, not a "no thanks" - the words are the offer's job, and a
            second sentence here would be arguing with somebody leaving. */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide this"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-mist hover:text-ink"
        >
          <MdClose aria-hidden className="text-[1.15rem]" />
        </button>
      </div>
    </div>
  );
}
