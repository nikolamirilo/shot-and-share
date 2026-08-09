"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The slab. The one place on the page where we spend boldness.
 *
 * A cheese hole and a camera aperture are the same shape, so the holes are not
 * decoration - they are viewfinders, and they carry the content. The slab in
 * the hero *is* the photo grid, and the photos live inside the holes.
 *
 * Two behaviours give it life and no more than two:
 *   1. On load the holes punch open in sequence with a slight overshoot.
 *   2. On pointer move the slab tilts on both axes and drifts a few pixels,
 *      which is what makes the holes read as real depth rather than dots.
 *
 * Both are off under prefers-reduced-motion.
 */

/** Placeholders. Replace with licensed or original imagery before launch. */
const PHOTOS = ["/hero/1.svg", "/hero/2.svg", "/hero/3.svg", "/hero/4.svg"];

interface HoleSpec {
  cx: number;
  cy: number;
  r: number;
  photo?: number;
}

const HOLES: HoleSpec[] = [
  { cx: 168, cy: 186, r: 66, photo: 0 },
  { cx: 348, cy: 132, r: 50, photo: 1 },
  { cx: 476, cy: 252, r: 58, photo: 2 },
  { cx: 246, cy: 344, r: 72, photo: 3 },
  { cx: 428, cy: 396, r: 32 },
  { cx: 108, cy: 336, r: 24 },
  { cx: 540, cy: 122, r: 19 },
];

const SLAB = "M 26 74 L 556 20 L 598 424 L 58 478 Z";

export function Slab({ qrHref }: { qrHref?: string }) {
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
        setTilt({
          x: -py * 11,
          y: px * 13,
          dx: px * 10,
          dy: py * 8,
        });
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
    <div
      ref={wrapRef}
      className="relative w-full select-none"
      style={{ perspective: "1200px" }}
    >
      <div
        className="relative"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translate3d(${tilt.dx}px, ${tilt.dy}px, 0)`,
          transformStyle: "preserve-3d",
          transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <svg
          viewBox="0 0 640 520"
          className="w-full drop-shadow-[0_18px_28px_rgba(31,22,7,0.14)]"
          role="img"
          aria-label="A slice of cheese with photos from an event inside its holes"
        >
          <defs>
            {/* The void: dark interior, inner shadow at the top, a faint warm
                bounce at the bottom. Every hole in the product is this. */}
            <radialGradient id="slab-depth" cx="50%" cy="34%" r="72%">
              <stop offset="55%" stopColor="#1F1607" stopOpacity="0" />
              <stop offset="100%" stopColor="#120C03" stopOpacity="0.85" />
            </radialGradient>
            <linearGradient id="slab-face" x1="0" y1="0" x2="0.35" y2="1">
              <stop offset="0" stopColor="#FFD666" />
              <stop offset="1" stopColor="#F0A000" />
            </linearGradient>
            <linearGradient id="slab-bounce" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#FFD666" stopOpacity="0.55" />
              <stop offset="45%" stopColor="#FFD666" stopOpacity="0" />
            </linearGradient>

            {HOLES.map((h, i) =>
              h.photo === undefined ? null : (
                <clipPath key={i} id={`slab-clip-${i}`}>
                  <circle cx={h.cx} cy={h.cy} r={h.r} />
                </clipPath>
              ),
            )}
          </defs>

          {/* Thickness: a Rind face offset below and behind, so it reads as a
              cut object with weight rather than a flat shape. */}
          <path
            d={SLAB}
            transform="translate(0 26)"
            fill="#B0670F"
            stroke="#1F1607"
            strokeWidth={7}
            strokeLinejoin="round"
          />
          <path
            d={SLAB}
            fill="url(#slab-face)"
            stroke="#1F1607"
            strokeWidth={7}
            strokeLinejoin="round"
          />

          {HOLES.map((h, i) => {
            const photoIndex = h.photo;
            return (
              <g
                key={i}
                className={motion ? "punch" : undefined}
                style={
                  motion
                    ? {
                        animationDelay: `${140 + i * 80}ms`,
                        transformOrigin: `${h.cx}px ${h.cy}px`,
                      }
                    : undefined
                }
              >
                <circle cx={h.cx} cy={h.cy} r={h.r} fill="#4A3110" />
                {photoIndex !== undefined && (
                  <image
                    href={PHOTOS[photoIndex]}
                    x={h.cx - h.r}
                    y={h.cy - h.r}
                    width={h.r * 2}
                    height={h.r * 2}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#slab-clip-${i})`}
                  />
                )}
                <circle
                  cx={h.cx}
                  cy={h.cy}
                  r={h.r}
                  fill="url(#slab-depth)"
                  style={{ mixBlendMode: "multiply" }}
                />
                <circle
                  cx={h.cx}
                  cy={h.cy}
                  r={h.r}
                  fill="url(#slab-bounce)"
                  opacity={0.5}
                />
                <circle
                  cx={h.cx}
                  cy={h.cy}
                  r={h.r}
                  fill="none"
                  stroke="#1F1607"
                  strokeWidth={5}
                />
              </g>
            );
          })}
        </svg>

        {/* The QR code is the actual product. A visitor should see the thing
            they are going to print before they read a word about it. */}
        {/* Held well clear of the right edge until the hero splits into two
            columns and there is page margin to spend.

            Six degrees of rotation and 60px of translateZ under a perspective
            put the card's painted corner about thirty pixels outside its own
            layout box. At `right-0` that lands past the viewport on every
            phone and tablet, and the code - the one element on the page whose
            job is to show people what they are going to print - was sliced in
            half by the screen edge. */}
        <div
          className="absolute -bottom-2 right-6 w-[44%] max-w-[190px] rotate-[6deg] rounded-2xl bg-cream p-2.5 shadow-lg sm:-bottom-4 sm:right-10 sm:w-[38%] sm:p-3 lg:right-4"
          style={{ transform: "rotate(6deg) translateZ(60px)" }}
        >
          <QrGlyph />
          <p className="mt-2 text-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-rind">
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
      <rect width="22" height="22" fill="#FFFDF4" />
      {cells.flatMap((row, y) =>
        row.split("").map((cell, x) =>
          cell === "1" ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#1F1607" />
          ) : null,
        ),
      )}
    </svg>
  );
}
