"use client";

import { useEffect, useRef, useState } from "react";
import { MdChatBubbleOutline, MdCloudQueue, MdOutlinePhotoCamera } from "react-icons/md";

import { Eyebrow, cx } from "@/components/ui";

/**
 * The loss, made visible. The README opens with it: two hundred guests take
 * two thousand photos and the couple sees maybe fifty.
 *
 * Two thousand dots, one per photo, running down each column and across the
 * night from 19:00 to 03:00. Fifty are lit. "With Shot & Share" fills the rest
 * in, in the direction the night ran. It switches itself once, the first time
 * the card is properly on screen, and the toggle works both ways after that.
 */

const N = 2000;
const SEEN = 50;
const INK = "#181214";
const PINE = "#2e4a45";
const EDGE = "#dcd1d3";

/** Fixed, never random per render: the same fifty on every visit. */
const LIT = (() => {
  let seed = 20260613;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const set = new Set<number>();
  while (set.size < SEEN) set.add(Math.floor(rnd() * N));
  return set;
})();

const LEAKS = [
  {
    Icon: MdChatBubbleOutline,
    title: "The group chat",
    body: "Photos arrive compressed and buried between hundreds of messages. Only people in the chat can add any.",
  },
  {
    Icon: MdCloudQueue,
    title: "The shared album",
    body: "Guests need the right Google or Apple account to add photos, so iPhones and Androids end up in different places.",
  },
  {
    Icon: MdOutlinePhotoCamera,
    title: "Disposable cameras",
    body: "Around €15 each for 27 shots, then days of waiting for prints. Nobody's phone photos end up anywhere.",
  },
];

const nf = new Intl.NumberFormat("en-GB");

export function Problem() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"without" | "with">("without");
  const [shown, setShown] = useState(SEEN);
  const progress = useRef(0);
  const touched = useRef(false);
  const drawRef = useRef<() => void>(() => {});

  // Draw, and redraw on resize. Column count follows the width so a dot never
  // shrinks below something a phone can show.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = el.clientWidth;
      const cols = w >= 720 ? 80 : 50;
      const rows = N / cols;
      const pitch = w / cols;
      const h = Math.round(pitch * rows);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
        el.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const r = Math.max(1.1, pitch * 0.27);
      for (let i = 0; i < N; i++) {
        const c = Math.floor(i / rows);
        const y = i % rows;
        const lit = LIT.has(i);
        const saved = !lit && c / (cols - 1) <= progress.current;
        ctx.fillStyle = lit ? INK : saved ? PINE : EDGE;
        ctx.beginPath();
        ctx.arc(c * pitch + pitch / 2, y * pitch + pitch / 2, saved ? r * 0.9 : r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawRef.current = draw;
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);


  // The wipe and the count, together.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = progress.current;
    const to = mode === "with" ? 1 : 0;
    const startCount = mode === "with" ? SEEN : N;
    const endCount = mode === "with" ? N : SEEN;
    if (reduce || from === to) {
      progress.current = to;
      setShown(endCount);
      drawRef.current();
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const ms = mode === "with" ? 1500 : 600;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      progress.current = mode === "with" ? k : 1 - k;
      setShown(Math.round(startCount + (endCount - startCount) * e));
      drawRef.current();
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  // Once, the first time it is properly seen.
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    let timer = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || touched.current) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        touched.current = true;
        timer = window.setTimeout(() => setMode("with"), 1600);
        io.disconnect();
      },
      { threshold: 0.55 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, []);

  const choose = (next: "without" | "with") => {
    touched.current = true;
    setMode(next);
  };

  return (
    <section id="problem" className="bg-linen">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-5 sm:py-20 lg:py-24">
        <div className="max-w-3xl">
          <Eyebrow>The usual way</Eyebrow>
          <h2 className="mt-3 text-[2.25rem] [word-spacing:0.1em] sm:text-[3.5rem]">
            Two hundred guests take two thousand photos. You see about fifty.
          </h2>
          <p className="mt-4 max-w-2xl text-body text-ash sm:text-lead">
            The rest stay on their phones, get squashed in a group chat, or sit
            in a shared album half the guests never joined.
          </p>
        </div>

        <div ref={card} className="card mt-10 p-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div aria-live="polite">
              <p
                className="font-display text-[clamp(2.75rem,2rem+2.4vw,4rem)] font-extrabold leading-[0.95] tracking-[-0.045em] tabular-nums"
                style={{ fontStretch: "84%" }}
              >
                {nf.format(shown)}
              </p>
              <p className="mt-1.5 text-small text-ash">
                {mode === "with"
                  ? "photos in one gallery by the morning"
                  : "photos the couple usually sees"}
              </p>
            </div>
            <div role="tablist" aria-label="Compare" className="inline-flex rounded-[0.875rem] bg-blush p-1 inset-shadow-well">
              {(
                [
                  ["without", "Without Shot & Share"],
                  ["with", "With Shot & Share"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => choose(key)}
                  className={cx(
                    "rounded-[0.625rem] px-3.5 py-2 text-small font-semibold transition-colors",
                    mode === key ? "bg-paper text-ink shadow-sm" : "text-ash",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <canvas
            ref={canvas}
            role="img"
            aria-label="2,000 dots, one per photo taken at a wedding. Without Shot & Share, 50 of them reach the couple. With it, all 2,000 do."
            className="mt-5 block w-full"
          />
          <div aria-hidden className="mt-2.5 flex justify-between font-mono text-micro tracking-[0.12em] text-mist">
            <span>19:00</span>
            <span>21:00</span>
            <span>23:00</span>
            <span>01:00</span>
            <span>03:00</span>
          </div>
          <p className="mt-3 text-label text-ash">Each dot is one photo, in the order it was taken.</p>
        </div>

        <div className="mt-11 grid gap-7 md:grid-cols-3 md:gap-8">
          {LEAKS.map(({ Icon, title, body }) => (
            <div key={title}>
              <span className="hole grid h-11 w-11 place-items-center text-rose-soft">
                <Icon aria-hidden className="text-[22px]" />
              </span>
              <h3 className="mt-3.5 text-h3 [word-spacing:0.1em]">{title}</h3>
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ash">{body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8">
          <a
            href="#how"
            className="font-semibold underline decoration-claret decoration-2 underline-offset-4 hover:decoration-ink"
          >
            See how Shot &amp; Share fixes it
          </a>
        </p>
      </div>
    </section>
  );
}
