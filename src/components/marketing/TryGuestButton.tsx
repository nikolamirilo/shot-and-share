"use client";

import { useEffect, useRef, useState } from "react";
import { MdOutlineTouchApp } from "react-icons/md";

import { Button, cx } from "@/components/ui";

/**
 * Plays the guest flow on the hero's phone rather than sending the visitor to
 * another page. The phone listens for the event; this button only asks, and
 * passes itself along so the phone can draw the spark that travels over.
 */
export function TryGuestButton() {
  const ref = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const onState = (e: Event) =>
      setPlaying((e as CustomEvent<{ playing: boolean }>).detail.playing);
    window.addEventListener("try-guest:state", onState);
    return () => window.removeEventListener("try-guest:state", onState);
  }, []);

  return (
    <Button
      ref={ref}
      type="button"
      size="lg"
      variant="secondary"
      aria-disabled={playing}
      aria-live="polite"
      className={cx("w-full sm:w-auto", playing && "cursor-default text-ash")}
      onClick={() => {
        if (playing) return;
        window.dispatchEvent(new CustomEvent("try-guest", { detail: { origin: ref.current } }));
      }}
    >
      {playing ? (
        <>
          <span aria-hidden className="cue-dot shrink-0" />
          Playing on the phone
        </>
      ) : (
        <>
          <MdOutlineTouchApp aria-hidden className="shrink-0 text-[1.25em]" />
          Try it as a guest
        </>
      )}
    </Button>
  );
}
