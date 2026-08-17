"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The contact sheet: what a night looks like before anybody has chosen a
 * favourite, which is what this product hands a host the morning after. The
 * hero is the artefact rather than a picture of the interface.
 *
 * Two behaviours, both off under prefers-reduced-motion: the frames rise in
 * shooting order on load, and the sheet tilts and drifts on pointer move, which
 * is what makes it read as paper on a table rather than a grid.
 */

/** Placeholders. Replace with licensed or original imagery before launch. */
const FRAMES = [
  "/hero/1.svg",
  "/hero/2.svg",
  "/hero/3.svg",
  "/hero/4.svg",
  "/hero/5.svg",
  "/hero/6.svg",
];

export function ContactSheet({ qrHref }: { qrHref?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, dx: 0, dy: 0 });
  const [motion, setMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotion(!query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!motion) return;
    const el = wrapRef.current;
    if (!el) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = el.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        setTilt({ x: -py * 8, y: px * 10, dx: px * 8, dy: py * 6 });
      });
    };
    const onLeave = () => setTilt({ x: 0, y: 0, dx: 0, dy: 0 });

    window.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [motion]);

  return (
    // The padding is the room the card hangs into. It is on the wrapper rather
    // than on the section, so the card can sit below and outside the sheet
    // without either covering a frame or reaching past the column: the sheet
    // gives up the width, and nothing downstream has to know.
    <div
      ref={wrapRef}
      className="relative w-full select-none pb-24 pr-6 sm:pb-28 sm:pr-9"
      style={{ perspective: "1400px" }}
    >
      <div
        className="relative"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translate3d(${tilt.dx}px, ${tilt.dy}px, 0)`,
          transformStyle: "preserve-3d",
          transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          className="rounded-card bg-paper p-3 shadow-lg sm:p-4"
          role="img"
          aria-label="A contact sheet of photographs from one evening, taken by guests"
        >
          {/* The strip a real sheet carries along its top edge: whose night
              it was, and how much of it there is. It sits above the frames so
              the bottom corner is free for the card to rest on.

              Both halves are 11px mono at 0.14em, which is 35 characters and
              about 300px of strip - wider than the sheet is on a phone, where
              it wrapped and broke the couple's own names across two lines. The
              guest count is the half that goes: the frame count is the number
              that says what the product did. */}
          <p className="mb-3 flex items-center justify-between gap-3 font-mono text-micro uppercase tracking-[0.14em] text-mist">
            <span className="whitespace-nowrap">Marta &amp; Iva</span>
            <span className="whitespace-nowrap">
              <span className="hidden xs:inline">96 guests · </span>2,140 frames
            </span>
          </p>

          {/* Every frame the same size, in the order they were taken. A contact
              sheet is uniform by definition - varying the tiles would be a
              layout being decorative about somebody's evening. */}
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {FRAMES.map((src, i) => (
              <div
                key={src}
                className={motion ? "rise" : undefined}
                style={motion ? { animationDelay: `${120 + i * 90}ms` } : undefined}
              >
                <div
                  className="recess aspect-square w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${src})` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* The QR code is the actual product, so a visitor sees the thing they
            will print before reading a word about it.

            It rests on the bottom-right corner and hangs off it. Sitting inside
            the sheet it covered the sixth frame almost whole, which is a card
            deleting a photograph in the one picture whose whole argument is
            that the photographs arrive: about two thirds of it is now below and
            outside the sheet, over a corner rather than over a frame.

            Six degrees of rotation and the translateZ push the painted corner
            roughly thirty pixels past its layout box, which is what the
            wrapper's padding is sized for. */}
        <div
          className="absolute -bottom-20 -right-3 w-[32%] max-w-33 rounded-2xl bg-paper p-2.5 shadow-lg sm:-bottom-24 sm:-right-4 sm:w-[30%]"
          style={{ transform: "rotate(6deg) translateZ(40px)" }}
        >
          <QrGlyph />
          {/* Tight leading, because on a phone the card is too narrow for this
              on one line and 1.65 makes the wrap look like an accident. */}
          <p className="mt-2 text-center font-mono text-micro uppercase leading-[1.3] tracking-widest text-mist">
            {qrHref ?? "scan to share"}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * A drawn stand-in for the code, not a scannable one. The real QR is generated
 * server-side as SVG per event; putting a live code in a marketing hero would
 * point two hundred wedding guests at a demo event.
 */
function QrGlyph() {
  const cells = [
    "1111111011010001111111",
    "1000001001100101000001",
    "1011101011010101011101",
    "1011101000111001011101",
    "1011101011001101011101",
    "1000001001011001000001",
    "1111111010101011111111",
    "0000000011100000000000",
    "1101101101011011011011",
    "0010010110100100100100",
    "1101011010110110101101",
    "0110100101001011010010",
    "1011011010110100101101",
    "0100100101001011010010",
    "1101101011010110110101",
    "0000000010110100101100",
    "1111111011010110110101",
    "1000001001001011010010",
    "1011101011010110110101",
    "1011101000101001011010",
    "1011101011011010110101",
    "1111111001001011010010",
  ];
  return (
    <svg viewBox="0 0 22 22" className="w-full" role="presentation">
      <rect width="22" height="22" fill="#FFFFFF" />
      {cells.flatMap((row, y) =>
        row.split("").map((cell, x) =>
          cell === "1" ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill="#181214"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
