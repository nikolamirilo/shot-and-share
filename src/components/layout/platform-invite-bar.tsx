"use client";

import { useEffect, useState } from "react";
import { MdClose } from "react-icons/md";

import { LogoMark } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui";

/**
 * Variant C's actual pitch: a bar that comes up once the guest has scrolled
 * through the gallery, on a free event only.
 *
 * It exists because of where the visits end. A guest opens the link, uploads,
 * scrolls a little and closes the tab; the footer at the bottom of the page is
 * read by the minority who keep going. This is the same offer, put where the
 * majority is.
 *
 * Three rules keep it from being an advert on somebody's wedding:
 *
 * - It waits. Nothing floats until the guest is most of the way down the page,
 *   which on an event page means they have seen the photographs.
 * - It goes away. One tap on the cross, and it stays gone for the rest of the
 *   session - the same visitor scrolling back up does not get it twice.
 * - It sits above the safe area and below nothing. The upload control is at the
 *   top of the page, so this never covers the thing the guest came to press.
 */

const DISMISSED = "ss:invite-dismissed";

/** How far down the page the guest has to be before the bar is allowed up. */
const TRIGGER = 0.55;

export function PlatformInviteBar() {
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(true);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISSED)) return;
    } catch {
      // Private mode, or storage turned off. Showing the bar is the safe
      // failure: the worst case is a guest dismissing it twice.
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
        // for, so the bar comes up as soon as it is on screen.
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
      role="region"
      aria-label="Shot & Share"
      className={`fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-300 motion-reduce:transition-none ${
        shown ? "translate-y-0" : "translate-y-[130%]"
      }`}
    >
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink/95 p-2 pl-3.5 shadow-lg backdrop-blur">
        <LogoMark variant="reversed" className="h-6 w-auto shrink-0" />

        <p className="min-w-0 flex-1 text-label leading-snug text-linen/85">
          Collecting photos like this is{" "}
          <span className="font-semibold text-linen">free</span> for your own
          event.
        </p>

        <ButtonLink
          href="/"
          target="_blank"
          rel="noopener"
          size="sm"
          variant="onDark"
          className="shrink-0 rounded-xl"
        >
          Try it
        </ButtonLink>

        {/* A cross, not a "no thanks" - the words are the offer's job, and a
            second sentence here would be arguing with somebody leaving. */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide this"
          className="-mr-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-linen/55 hover:text-linen"
        >
          <MdClose aria-hidden className="text-[1.15rem]" />
        </button>
      </div>
    </div>
  );
}
