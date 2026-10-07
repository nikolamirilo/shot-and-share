"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MdCheck, MdOutlineAddAPhoto } from "react-icons/md";

import { LottiePlayer, type LottieHandle } from "@/components/marketing/lottie-player";
import mark from "@/components/marketing/lottie/mark.json";
import scan from "@/components/marketing/lottie/scan.json";
import { QrGlyph } from "@/components/marketing/qr-glyph";
import { Photo, cx } from "@/components/ui";

/**
 * The hero's picture: the card on the table, a guest's phone, and the night's
 * count. The phone is the guest page in miniature and it works - tapping "Add
 * your photos" plays the real sequence (camera roll, sending, thank you), so a
 * visitor sees exactly what their guests will do without leaving the page.
 *
 * Between taps, other guests "upload": a frame lands every few seconds and the
 * count ticks. That stops off-screen and for anybody who prefers less motion.
 */

const frame = (n: number) => `/hero/variants/${String(n).padStart(2, "0")}.jpg`;

/** Newest first, like the real gallery. */
const START = [2, 11, 9, 6, 4, 1, 10, 5, 12];
const ARRIVALS = [3, 8, 1, 9, 6, 11, 4, 2, 10, 12, 5, 7];
/** What the camera roll offers, and which three the "guest" picks. */
const ROLL = [4, 9, 1, 6, 11, 2, 8, 12, 5];
const PICKED = [1, 3, 7];

type Stage = "idle" | "picking" | "sending" | "done";

const nf = new Intl.NumberFormat("en-GB");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function HeroScene() {
  const [tiles, setTiles] = useState(() => START.map((n, i) => ({ key: `s${i}`, n })));
  const [count, setCount] = useState(1342);
  const [bumped, setBumped] = useState(0);
  const [stage, setStage] = useState<Stage>("idle");
  const [selected, setSelected] = useState<number[]>([]);
  const [sent, setSent] = useState(0);
  const [tapped, setTapped] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const markRef = useRef<LottieHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const visible = useRef(true);
  const seq = useRef(0);

  const land = useCallback((n: number, by = 1) => {
    seq.current += 1;
    const key = `a${seq.current}`;
    setTiles((t) => [{ key, n }, ...t].slice(0, 9));
    setCount((c) => c + by);
    setBumped((b) => b + 1);
  }, []);

  // Other guests, uploading while the visitor reads.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting), {
      threshold: 0.2,
    });
    io.observe(el);
    let i = 0;
    const timer = setInterval(() => {
      if (stage !== "idle" || !visible.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      land(ARRIVALS[i % ARRIVALS.length], i % 3 === 2 ? 2 : 1);
      i += 1;
    }, 3400);
    return () => {
      clearInterval(timer);
      io.disconnect();
    };
  }, [stage, land]);

  const run = useCallback(async () => {
    if (stage !== "idle") return;
    const quick = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = (ms: number) => sleep(quick ? Math.min(ms, 40) : ms);
    setTapped(true);
    setSelected([]);
    setSent(0);

    setStage("picking");
    await wait(30);
    setSheetOpen(true);
    await wait(520);
    for (const idx of PICKED) {
      setSelected((s) => [...s, idx]);
      await wait(360);
    }
    await wait(300);
    setSheetOpen(false);
    await wait(380);

    setStage("sending");
    for (let i = 0; i < PICKED.length; i++) {
      setSent(i + 1);
      await wait(660);
      land(ROLL[PICKED[i]]);
    }
    await wait(200);

    setStage("done");
    markRef.current?.replay();
    await wait(2600);
    setStage("idle");
  }, [stage, land]);

  // The hero's "Try it as a guest" button reaches in here.
  useEffect(() => {
    const onTry = () => {
      const el = root.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const inView = r.top >= 0 && r.bottom <= window.innerHeight;
      if (!inView) el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(run, inView ? 0 : 520);
    };
    window.addEventListener("try-guest", onTry);
    return () => window.removeEventListener("try-guest", onTry);
  }, [run]);

  return (
    <div ref={root} className="mx-auto w-full max-w-[540px]">
      <div className="scene">
        <p className="scene-chip">
          <span className="live-dot" aria-hidden />
          Live
          <b key={bumped} className={bumped ? "count-bump" : undefined}>
            {nf.format(count)}
          </b>
          photos
        </p>

        <div className="scene-phone">
          <div
            className="relative aspect-[9/18.6] rounded-[15cqw] bg-ink p-[3.3cqw]"
            style={{
              boxShadow:
                "0 12cqw 22cqw -8cqw rgba(24,18,20,.55),0 3cqw 6cqw -2cqw rgba(24,18,20,.3),inset 0 0 0 .5cqw #3a2e31",
            }}
          >
            <div className="relative isolate h-full overflow-hidden rounded-[11.8cqw] bg-linen text-[4.1cqw] leading-[1.35]">
              {/* Status bar over the cover, the way a phone draws it. */}
              <div aria-hidden className="absolute left-1/2 top-[2.8cqw] z-20 h-[7.4cqw] w-[26cqw] -translate-x-1/2 rounded-full bg-black" />
              <div aria-hidden className="absolute inset-x-0 top-0 z-10 flex justify-between px-[8.5cqw] pt-[3.6cqw] text-[3.5cqw] font-semibold text-white">
                <span>22:47</span>
                <svg viewBox="0 0 66 22" className="h-[3.6cqw] w-[11cqw] fill-white">
                  <rect x="0" y="13" width="5" height="8" rx="1.5" />
                  <rect x="8" y="9" width="5" height="12" rx="1.5" />
                  <rect x="16" y="5" width="5" height="16" rx="1.5" />
                  <rect x="24" y="1" width="5" height="20" rx="1.5" />
                  <rect x="36" y="2" width="26" height="18" rx="5" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <rect x="39.5" y="5.5" width="17" height="11" rx="2.5" />
                  <rect x="63" y="8" width="3" height="6" rx="1.5" />
                </svg>
              </div>

              <div className="relative h-[64cqw]">
                <Photo src={frame(7)} alt="" fill sizes="300px" className="object-cover object-[50%_30%]" priority />
                <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.8)_0%,rgba(0,0,0,.42)_30%,rgba(0,0,0,.04)_58%,rgba(0,0,0,.28)_100%)]" />
                <div className="absolute inset-x-[6cqw] bottom-[5.5cqw] text-chalk">
                  <span className="block font-mono text-[2.7cqw] uppercase tracking-[0.16em] opacity-85">
                    Sat 13 June 2026
                  </span>
                  <span
                    className="mt-[1.2cqw] block font-display text-[11cqw] font-extrabold leading-[0.96] tracking-[-0.046em] [word-spacing:0.1em]"
                    style={{ fontStretch: "82%" }}
                  >
                    Ana &amp; Marko
                  </span>
                </div>
              </div>

              <div className="relative mx-[4cqw] mt-[4cqw] rounded-[5cqw] bg-paper p-[4cqw] shadow-md">
                <button
                  type="button"
                  onClick={run}
                  disabled={stage !== "idle"}
                  aria-label="Try the guest upload"
                  className={cx(
                    "relative flex min-h-[13.5cqw] w-full items-center justify-center gap-[2cqw] rounded-[4cqw] bg-claret text-[4.7cqw] font-semibold text-chalk shadow-md transition-opacity disabled:cursor-default disabled:opacity-55",
                    !tapped && "tap-ring",
                  )}
                >
                  <MdOutlineAddAPhoto aria-hidden className="h-[5.6cqw] w-[5.6cqw]" />
                  {stage === "sending" ? `Sending ${sent} of ${PICKED.length}…` : "Add your photos"}
                </button>
                {stage === "sending" ? (
                  <div className="mt-[3cqw] h-[2.2cqw] overflow-hidden rounded-full bg-blush shadow-[inset_0_1px_3px_rgba(24,18,20,.12)]">
                    <div
                      className="h-full rounded-full bg-claret transition-[width] duration-700"
                      style={{ width: `${(sent / PICKED.length) * 100}%` }}
                    />
                  </div>
                ) : (
                  <p className="mt-[2.6cqw] text-center text-[3.3cqw] leading-[1.4] text-ash">
                    Photos and video, straight from your camera roll.
                  </p>
                )}
                <div
                  className={cx(
                    "absolute inset-0 flex items-center gap-[3cqw] rounded-[inherit] bg-paper px-[4cqw]",
                    stage !== "done" && "hidden",
                  )}
                  role="status"
                >
                  <LottiePlayer data={mark} rest={95} once manual ref={markRef} className="h-[15cqw] w-[15cqw] shrink-0" />
                  <div>
                    <b
                      className="block font-display text-[5.2cqw] font-extrabold leading-[1.05] tracking-[-0.03em]"
                      style={{ fontStretch: "82%" }}
                    >
                      Thank you!
                    </b>
                    <span className="mt-[0.6cqw] block text-[3.2cqw] leading-[1.3] text-ash">
                      {PICKED.length} photos added to Ana &amp; Marko.
                    </span>
                  </div>
                </div>
              </div>

              <p className="mx-[7cqw] mt-[2.6cqw] text-center text-[2.6cqw] leading-[1.45] text-ash">
                By uploading you confirm you have permission from the people in your photos.
              </p>
              <div className="mx-[5cqw] mb-[2.2cqw] mt-[4.4cqw] flex items-baseline justify-between font-mono text-[2.6cqw] uppercase tracking-[0.14em] text-mist">
                <span>Shared gallery</span>
                <span className="text-ink tabular-nums">{nf.format(count)}</span>
              </div>
              <div className="grid grid-cols-3 gap-[1.6cqw] px-[4cqw]">
                {tiles.map((t) => (
                  <div key={t.key} className={cx("recess relative aspect-square overflow-hidden", t.key.startsWith("a") && "tile-in")}>
                    <Photo src={frame(t.n)} alt="" fill sizes="96px" className="object-cover" />
                  </div>
                ))}
              </div>
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[16cqw] bg-[linear-gradient(rgba(246,242,243,0),var(--color-linen)_70%)]" />

              {/* The camera roll the phone offers, and three taps in it. */}
              {stage === "picking" && (
                <>
                  <div className={cx("absolute inset-0 z-20 bg-black/35 transition-opacity duration-300", sheetOpen ? "opacity-100" : "opacity-0")} />
                  <div
                    aria-hidden
                    className={cx(
                      "absolute inset-x-0 bottom-0 z-30 h-[72%] rounded-t-[6cqw] bg-[#f3f1f2] px-[3.4cqw] pb-[6cqw] pt-[3.4cqw] shadow-[0_-3cqw_8cqw_rgba(0,0,0,.3)] transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)]",
                      sheetOpen ? "translate-y-0" : "translate-y-[103%]",
                    )}
                  >
                    <div className="mx-auto mb-[2.6cqw] h-[1.2cqw] w-[12cqw] rounded-full bg-ink/20" />
                    <div className="flex items-center justify-between px-[1.4cqw] pb-[3cqw] text-[3.7cqw]">
                      <span className="text-mist">Cancel</span>
                      <span className="font-bold">Recents</span>
                      <span className="rounded-full bg-ink px-[3cqw] py-[1cqw] text-[3.4cqw] font-semibold text-chalk">
                        {selected.length ? `Add (${selected.length})` : "Add"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-[1cqw]">
                      {ROLL.map((n, i) => {
                        const on = selected.includes(i);
                        return (
                          <div key={n} className="relative aspect-square overflow-hidden rounded-[1.2cqw]">
                            <Photo
                              src={frame(n)}
                              alt=""
                              fill
                              sizes="90px"
                              className={cx("object-cover transition-transform", on && "scale-90")}
                            />
                            <span
                              className={cx(
                                "absolute bottom-[2cqw] right-[2cqw] grid h-[5.4cqw] w-[5.4cqw] place-items-center rounded-full border-[0.6cqw] border-white shadow",
                                on && "bg-ink",
                              )}
                            >
                              {on && <MdCheck className="h-[3.6cqw] w-[3.6cqw] text-white" />}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
              <div aria-hidden className="absolute bottom-[2.2cqw] left-1/2 z-40 h-[1.2cqw] w-[34cqw] -translate-x-1/2 rounded-full bg-ink/80" />
            </div>
          </div>
        </div>

        <figure className="scene-card" aria-label="The printed QR card on a table">
          <p className="font-mono text-[1.85cqw] uppercase leading-[1.3] tracking-[0.16em] text-mist max-sm:text-[2.3cqw]">
            Scan to add your photos
          </p>
          <div className="relative mx-auto mt-[2.6cqw] aspect-square w-[74%]">
            <QrGlyph className="block h-full w-full" />
            <LottiePlayer data={scan} rest={92} className="pointer-events-none !absolute -inset-[14%]" />
          </div>
          <p
            className="mt-[3.4cqw] font-display text-[5.4cqw] font-extrabold leading-none tracking-[-0.046em] [word-spacing:0.1em]"
            style={{ fontStretch: "82%" }}
          >
            Ana &amp; Marko
          </p>
          <p className="mt-[1.4cqw] font-mono text-[1.75cqw] uppercase tracking-[0.14em] text-mist max-sm:text-[2.2cqw]">
            13.06.2026 · No app needed
          </p>
        </figure>
      </div>
    </div>
  );
}
