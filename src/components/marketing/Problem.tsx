"use client";

import { useEffect, useRef, useState } from "react";
import { MdClose } from "react-icons/md";

import { Eyebrow, Photo, cx } from "@/components/ui";
import { heroFrame } from "@/utils/hero";

type Mode = "usual" | "with";

const TABLES = [
  { name: "Family", seats: 8, usual: 2, with: 6 },
  { name: "Uni friends", seats: 10, usual: 2, with: 8 },
  { name: "Work", seats: 8, usual: 2, with: 7 },
  { name: "Cousins", seats: 10, usual: 2, with: 8 },
  { name: "Neighbours", seats: 8, usual: 1, with: 6 },
];

const GUESTS = TABLES.reduce((n, t) => n + t.seats, 0);
const sharing = (mode: Mode) => TABLES.reduce((n, t) => n + t[mode], 0);

/**
 * Seeded, so the server and the browser light the same seats. A seat's rank decides when
 * it shares: rank below `usual` shares either way, rank below `with` only with us.
 */
const PLAN = (() => {
  let seed = 20260613;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return TABLES.map((t, ti) => {
    const order = Array.from({ length: t.seats }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const rank = new Array<number>(t.seats);
    order.forEach((seat, r) => (rank[seat] = r));
    return {
      ...t,
      rank,
      delay: rank.map(() => Math.round(rnd() * 650)),
      frame: rank.map((_, i) => ((ti * 5 + i * 7) % 12) + 1),
    };
  });
})();

const LEAKS = [
  ["Group chat", "compressed"],
  ["Shared album", "needs the right account"],
  ["Disposable camera", "€15 for 27 shots"],
];

function Table({ table, mode, index }: { table: (typeof PLAN)[number]; mode: Mode; index: number }) {
  const lit = table[mode];
  return (
    <div className={cx("col-span-2 sm:col-span-1", index === 3 && "col-start-2 sm:col-start-auto")}>
      <div className="@container relative aspect-square">
        <span className="absolute inset-[23%] grid place-content-center rounded-full bg-paper text-center font-mono text-[9cqw] leading-none text-mist shadow-md tabular-nums">
          <b className="block font-display text-[17cqw] font-extrabold tracking-[-0.04em] text-ink [font-stretch:82%]">
            {lit}
          </b>
          /{table.seats}
        </span>
        {table.rank.map((rank, i) => {
          const on = rank < lit;
          const turn = i / table.seats;
          return (
            <span
              key={i}
              className={cx(
                "absolute left-1/2 top-1/2 size-[18cqw] overflow-hidden rounded-full",
                on
                  ? "seat-pop shadow-[0_0_0_1.5px_var(--color-paper),0_0_0_3px_var(--color-ink)]"
                  : "bg-paper shadow-[inset_0_0_0_1.5px_var(--color-edge)]",
              )}
              style={{
                transform: `translate(-50%, -50%) rotate(${turn}turn) translateY(-40cqw) rotate(${-turn}turn)`,
                animationDelay: on ? `${table.delay[i]}ms` : undefined,
              }}
            >
              {on && <Photo src={heroFrame(table.frame[i])} alt="" fill sizes="64px" className="object-cover" />}
            </span>
          );
        })}
      </div>
      <p className="mt-2 text-center font-mono text-[0.625rem] uppercase tracking-[0.12em] text-mist">
        {table.name}
      </p>
    </div>
  );
}

export function Problem() {
  const card = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("usual");
  const [shown, setShown] = useState(sharing("usual"));
  const shownRef = useRef(shown);
  const touched = useRef(false);

  useEffect(() => {
    const to = sharing(mode);
    const from = shownRef.current;
    if (from === to || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shownRef.current = to;
      setShown(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const ms = mode === "with" ? 1100 : 500;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const value = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      shownRef.current = value;
      setShown(value);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  // Flips to "with" once, the first time the card is seen, unless the visitor got there first.
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

  const choose = (next: Mode) => {
    touched.current = true;
    setMode(next);
  };

  const withUs = mode === "with";

  return (
    <section id="problem" className="bg-linen">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-5 sm:py-20 lg:py-24">
        <Eyebrow>The usual way</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-[2.25rem] [word-spacing:0.1em] sm:text-[3.5rem]">
          Most guests never send their photos.
        </h2>

        <div ref={card} className="card mt-8 p-4 sm:mt-10 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div aria-live="polite">
              <p
                className="font-display text-[clamp(2.75rem,2rem+2.4vw,4rem)] font-extrabold leading-[0.95] tracking-[-0.045em] tabular-nums"
                style={{ fontStretch: "84%" }}
              >
                {shown}
                <span className="text-[0.42em] tracking-[-0.02em] text-mist"> / {GUESTS} guests</span>
              </p>
              <p className="mt-1.5 text-small text-ash">
                {withUs ? "share their photos with Shot & Share" : "share their photos the usual way"}
                <span
                  className={cx(
                    "ml-2 inline-block rounded-full px-2 py-0.5 align-[2px] font-mono text-micro tracking-[0.08em]",
                    withUs ? "bg-claret text-chalk" : "bg-blush text-ink",
                  )}
                >
                  {withUs ? "8 in 10" : "1 in 5"}
                </span>
              </p>
            </div>
            <div role="tablist" aria-label="Compare" className="inline-flex rounded-[0.875rem] bg-blush p-1 inset-shadow-well">
              {(
                [
                  ["usual", "The usual way"],
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

          <div
            role="img"
            aria-label={`Five tables, ${GUESTS} guests. The usual way, ${sharing("usual")} share their photos. With Shot & Share, ${sharing("with")} do.`}
            className="mt-5 grid grid-cols-6 gap-x-3 gap-y-5 rounded-xl bg-linen bg-[radial-gradient(var(--color-edge)_1px,transparent_1.3px)] bg-[length:18px_18px] px-3 pb-4 pt-6 sm:grid-cols-5 sm:gap-x-8 sm:px-6"
          >
            {PLAN.map((table, i) => (
              <Table key={table.name} table={table} mode={mode} index={i} />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-mist">
              Why the usual way fails
            </span>
            {LEAKS.map(([where, why]) => (
              <span key={where} className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3 py-1.5 text-label leading-snug">
                <MdClose aria-hidden className="shrink-0 text-claret" />
                {where} <span className="text-ash">{why}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
