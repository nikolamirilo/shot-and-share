"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MdCheck, MdOutlineAddAPhoto } from "react-icons/md";

import { LottiePlayer, type LottieHandle } from "@/components/marketing/LottiePlayer";
import mark from "@/components/marketing/lottie/mark.json";
import scan from "@/components/marketing/lottie/scan.json";
import { QR_GLYPH_QUIET, QrGlyph } from "@/components/marketing/QrGlyph";
import { Photo, cx } from "@/components/ui";
import { formatCount } from "@/utils/format";
import { heroFrame } from "@/utils/hero";


const START = [2, 11, 9, 6, 4, 1, 10, 5, 12];
const ARRIVALS = [3, 8, 1, 9, 6, 11, 4, 2, 10, 12, 5, 7];
const ROLL = [4, 9, 1, 6, 11, 2, 8, 12, 5];
const PICKED = [1, 3, 7];

type Stage = "idle" | "scanning" | "opening" | "picking" | "sending" | "done";

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
  const [wake, setWake] = useState(0);
  const [cardTf, setCardTf] = useState("");
  const [locked, setLocked] = useState(false);
  const [cardGone, setCardGone] = useState(false);
  const markRef = useRef<LottieHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const phone = useRef<HTMLDivElement>(null);
  const qr = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLSpanElement>(null);
  const visible = useRef(true);
  const seq = useRef(0);

  const land = useCallback((n: number, by = 1) => {
    seq.current += 1;
    const key = `a${seq.current}`;
    setTiles((t) => [{ key, n }, ...t].slice(0, 9));
    setCount((c) => c + by);
    setBumped((b) => b + 1);
  }, []);

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

  // The card steps into the middle of the scene to be scanned. Measured, not
  // hard-coded: the card's height follows its own text.
  const focusCard = useCallback(() => {
    const box = scene.current;
    const el = card.current;
    if (!box || !el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const s = Math.min(1.4, (box.clientHeight * 0.92) / h, (box.clientWidth * 0.8) / w);
    const dx = box.clientWidth / 2 - (el.offsetLeft + w / 2);
    // It grows from its bottom edge, so the half it gains upward is paid back.
    const dy = box.clientHeight / 2 - el.offsetTop - h + (s * h) / 2;
    setCardTf(`translate(${dx}px, ${dy}px) scale(${s}) rotate(0deg)`);
  }, []);

  const hidePhone = useCallback(
    () =>
      phone.current?.animate(
        [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: "scale(.88) translateY(4%)" },
        ],
        { duration: 420, easing: "cubic-bezier(.4,0,1,1)", fill: "both" },
      ),
    [],
  );

  // The scanned code becomes the phone: it grows out of the QR and settles in
  // place. Measured while the card is still centred, so the start point is the
  // code the visitor was just looking at.
  const growPhone = useCallback(() => {
    const box = scene.current;
    const el = phone.current;
    const code = qr.current;
    if (!box || !el || !code) return null;
    const b = box.getBoundingClientRect();
    const c = code.getBoundingClientRect();
    const dx = c.left + c.width / 2 - b.left - (el.offsetLeft + el.offsetWidth / 2);
    const dy = c.top + c.height / 2 - b.top - (el.offsetTop + el.offsetHeight / 2);
    return el.animate(
      [
        {
          opacity: 0,
          transform: `translate(${dx}px, ${dy}px) scale(${Math.min(0.38, c.width / el.offsetWidth)})`,
        },
        { opacity: 1, offset: 0.35 },
        { opacity: 1, transform: "translate(0px, 0px) scale(1)" },
      ],
      { duration: 820, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" },
    );
  }, []);

  const run = useCallback(
    async (scanFirst = false) => {
      if (stage !== "idle") return;
      const quick = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const wait = (ms: number) => sleep(quick ? Math.min(ms, 40) : ms);
      window.dispatchEvent(new CustomEvent("try-guest:state", { detail: { playing: true } }));
      setTapped(true);
      setSelected([]);
      setSent(0);
      setLocked(false);
      setCardGone(false);

      if (scanFirst) {
        setStage("scanning");
        const away = quick ? undefined : hidePhone();
        if (!quick) focusCard();
        await wait(1400);
        setLocked(true);
        await wait(700);

        setStage("opening");
        // Measured before the card goes, so the phone leaves from the code's
        // place on screen; it also outranks the fade that is hiding the phone.
        const flight = quick ? null : growPhone();
        // The code has done its job and clears out: one thing to watch.
        setCardGone(true);
        away?.cancel();
        if (flight) {
          await flight.finished.catch(() => {});
          flight.cancel();
        }
        // Back to the table while it is out of sight, ready for the next play.
        setCardTf("");
        setLocked(false);
        await wait(160);
      }

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
      setCardGone(false);
      window.dispatchEvent(new CustomEvent("try-guest:state", { detail: { playing: false } }));
    },
    [stage, land, focusCard, hidePhone, growPhone],
  );

  // The hero's "Try it as a guest" button reaches in here.
  useEffect(() => {
    // A spark leaves the button and lands on the printed code, so the click and
    // the scan read as one thing. Driven by the Web Animations API with plain
    // pixel transforms: that stays on the compositor, where nothing the scene
    // is rendering can stutter it.
    const spark = (origin: HTMLElement | null) => {
      const dot = cueRef.current;
      const target = qr.current;
      if (!dot || !origin || !target) return null;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;

      const a = origin.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const x0 = a.left + a.width / 2;
      const y0 = a.top + a.height / 2;
      const x1 = b.left + b.width / 2;
      const y1 = b.top + b.height / 2;
      // Control point of the arc: halfway across, lifted into a toss.
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2 - Math.max(40, Math.hypot(x1 - x0, y1 - y0) * 0.16);

      const frames = Array.from({ length: 17 }, (_, i) => {
        const t = i / 16;
        const m = 1 - t;
        const x = m * m * x0 + 2 * m * t * cx + t * t * x1;
        const y = m * m * y0 + 2 * m * t * cy + t * t * y1;
        const scale = t < 0.15 ? 0.45 + (t / 0.15) * 0.55 : t > 0.8 ? 1 - ((t - 0.8) / 0.2) * 0.5 : 1;
        const opacity = t < 0.12 ? t / 0.12 : t > 0.85 ? (1 - t) / 0.15 : 1;
        return { transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`, opacity };
      });

      return dot.animate(frames, { duration: 620, easing: "cubic-bezier(.45,0,.3,1)" });
    };

    const onTry = (e: Event) => {
      const el = root.current;
      if (!el) return;
      const origin = (e as CustomEvent<{ origin?: HTMLElement | null }>).detail?.origin ?? null;
      const r = el.getBoundingClientRect();
      const inView = r.top >= 0 && r.bottom <= window.innerHeight;
      if (!inView) el.scrollIntoView({ behavior: "smooth", block: "center" });
      window.dispatchEvent(new CustomEvent("try-guest:state", { detail: { playing: true } }));

      setTimeout(
        () => {
          const flight = spark(origin);
          if (!flight) {
            run(true);
            return;
          }
          // The card answers as the dot lands, not while it is still in the air.
          flight.finished.then(() => {
            setWake((w) => w + 1);
            run(true);
          }, () => run(true));
        },
        inView ? 0 : 520,
      );
    };
    window.addEventListener("try-guest", onTry);
    return () => window.removeEventListener("try-guest", onTry);
  }, [run]);

  const scanning = stage === "scanning" || stage === "opening";

  return (
    <div ref={root} className="mx-auto w-full max-w-135">
      <span ref={cueRef} aria-hidden className="cue-fly" />
      <div ref={scene} className="scene">
        <p className={cx("scene-chip", scanning && "opacity-0")}>
          <span className="live-dot" aria-hidden />
          Live
          <b key={bumped} className={bumped ? "count-bump" : undefined}>
            {formatCount(count)}
          </b>
          photos
        </p>

        <div ref={phone} className="scene-phone">
          <div
            className="relative aspect-[9/18.6] rounded-[15cqw] bg-ink p-[3.3cqw]"
            style={{
              boxShadow:
                "0 12cqw 22cqw -8cqw rgba(24,18,20,.55),0 3cqw 6cqw -2cqw rgba(24,18,20,.3),inset 0 0 0 .5cqw #3a2e31",
            }}
          >
            <div className="relative isolate h-full overflow-hidden rounded-[11.8cqw] bg-linen text-[4.1cqw] leading-[1.35]">
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
                <Photo src={heroFrame(7)} alt="" fill sizes="300px" className="object-cover object-[50%_30%]" priority />
                <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.8)_0%,rgba(0,0,0,.42)_30%,rgba(0,0,0,.04)_58%,rgba(0,0,0,.28)_100%)]" />
                <div className="absolute inset-x-[6cqw] bottom-[5.5cqw] text-chalk">
                  <span className="block font-mono text-[2.7cqw] uppercase tracking-[0.16em] opacity-85">
                    Sat 13 June 2026
                  </span>
                  <span
                    className="mt-[1.2cqw] block font-display text-[11cqw] font-extrabold leading-[0.96] tracking-[-0.046em] [word-spacing:0.1em]"
                    style={{ fontStretch: "82%" }}
                  >
                    Romeo &amp; Juliet
                  </span>
                </div>
              </div>

              <div className="relative mx-[4cqw] mt-[4cqw] rounded-[5cqw] bg-paper p-[4cqw] shadow-md">
                <button
                  type="button"
                  onClick={() => run()}
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
                      {PICKED.length} photos added to Romeo &amp; Juliet.
                    </span>
                  </div>
                </div>
              </div>

              <p className="mx-[7cqw] mt-[2.6cqw] text-center text-[2.6cqw] leading-[1.45] text-ash">
                By uploading you confirm you have permission from the people in your photos.
              </p>
              <div className="mx-[5cqw] mb-[2.2cqw] mt-[4.4cqw] flex items-baseline justify-between font-mono text-[2.6cqw] uppercase tracking-[0.14em] text-mist">
                <span>Shared gallery</span>
                <span className="text-ink tabular-nums">{formatCount(count)}</span>
              </div>
              <div className="grid grid-cols-3 gap-[1.6cqw] px-[4cqw]">
                {tiles.map((t) => (
                  <div key={t.key} className={cx("recess relative aspect-square overflow-hidden", t.key.startsWith("a") && "tile-in")}>
                    <Photo src={heroFrame(t.n)} alt="" fill sizes="96px" className="object-cover" />
                  </div>
                ))}
              </div>
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[16cqw] bg-[linear-gradient(rgba(246,242,243,0),var(--color-linen)_70%)]" />

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
                              src={heroFrame(n)}
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

        <figure
          ref={card}
          className="scene-card"
          data-focus={cardTf ? "true" : undefined}
          data-gone={cardGone ? "true" : undefined}
          style={cardTf ? ({ "--card-tf": cardTf } as React.CSSProperties) : undefined}
          aria-label="The printed QR card on a table"
        >
          {wake > 0 && (
            <span key={wake} aria-hidden className="card-wake" onAnimationEnd={() => setWake(0)} />
          )}
          <p
            className={cx(
              "font-mono text-[1.85cqw] uppercase leading-[1.3] tracking-[0.16em] max-sm:text-[2.3cqw]",
              scanning ? "text-claret" : "text-mist",
            )}
          >
            {stage === "opening"
              ? "Opening the gallery"
              : stage === "scanning"
                ? locked
                  ? "Code matched"
                  : "Scanning…"
                : "Scan to add your photos"}
          </p>
          <div ref={qr} className="relative mx-auto mt-[2.6cqw] aspect-square w-[92%]">
            <QrGlyph className="block h-full w-full" />
            {/* The reticle tracks the modules, not the quiet zone around them. */}
            <div className="absolute" style={{ inset: QR_GLYPH_QUIET }}>
              <LottiePlayer data={scan} rest={92} className="pointer-events-none absolute! -inset-[14%]" />
              {stage === "scanning" && !locked && <span aria-hidden className="qr-sweep" />}
            </div>
            {locked && (
              <span aria-hidden className="qr-lock absolute inset-0 grid place-items-center">
                <span className="grid h-[34%] w-[34%] place-items-center rounded-full bg-pine text-chalk shadow-lg ring-[0.55cqw] ring-paper">
                  <MdCheck className="h-[62%] w-[62%]" />
                </span>
              </span>
            )}
          </div>
          <p
            className="mt-[3.4cqw] font-display text-[5.4cqw] font-extrabold leading-none tracking-[-0.046em] [word-spacing:0.1em]"
            style={{ fontStretch: "82%" }}
          >
            Romeo &amp; Juliet
          </p>
          <p className="mt-[1.4cqw] font-mono text-[1.75cqw] uppercase tracking-[0.14em] text-mist max-sm:text-[2.2cqw]">
            13.06.2026 · No app needed
          </p>
        </figure>
      </div>
    </div>
  );
}
