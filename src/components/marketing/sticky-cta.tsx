"use client";

import { useEffect, useState } from "react";
import { MdOutlineAddCircleOutline } from "react-icons/md";

import { ButtonLink, cx } from "@/components/ui";

/**
 * The main button, within thumb reach on a phone.
 *
 * Between the hero and the closing band there was nothing to press. This bar
 * comes up once the hero's buttons have scrolled away and goes again when the
 * closing band's are on screen, so it never sits on top of its own twin.
 * Phones only: on a wider screen the header is always there.
 */
export function StickyCta({ href }: { href: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = { hero: true, closing: false };
    const hero = document.getElementById("hero-ctas");
    const closing = document.getElementById("closing-ctas");
    if (!hero || !closing) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen[e.target === hero ? "hero" : "closing"] = e.isIntersecting;
      setShow(!seen.hero && !seen.closing);
    });
    io.observe(hero);
    io.observe(closing);
    return () => io.disconnect();
  }, []);

  return (
    <div
      aria-hidden={!show}
      inert={!show}
      className={cx(
        "fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 bg-paper/95 px-4 pt-2.5 shadow-[0_-6px_22px_rgba(24,18,20,0.12)] backdrop-blur transition-transform duration-300 sm:hidden",
        "pb-[calc(0.625rem+env(safe-area-inset-bottom))]",
        show ? "translate-y-0" : "translate-y-[110%]",
      )}
    >
      <ButtonLink href={href} variant="primary" className="flex-1">
        <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
        Create your free event
      </ButtonLink>
      <span className="font-mono text-[0.625rem] uppercase leading-snug tracking-[0.14em] text-mist">
        Free
        <br />
        No card
      </span>
    </div>
  );
}
