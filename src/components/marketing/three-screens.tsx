"use client";

import { useEffect, useRef, useState } from "react";
import {
  MdCheck,
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdFavorite,
  MdFavoriteBorder,
  MdOutlineFileDownload,
  MdOutlineSlideshow,
  MdPause,
  MdPlayArrow,
} from "react-icons/md";

import { Button, Eyebrow, Hole, Photo, cx } from "@/components/ui";

/**
 * The product, on the page where the decision is made, rather than one click
 * and a page load away on /demo.
 *
 * Three tabs for the three screens of a night: what a guest taps, what the
 * host keeps, what the room watches. The guest tab has the one real test on
 * the page - pick photos from this device and they are re-encoded in the
 * browser the way a guest's phone does it, with the saving shown. Nothing
 * leaves the device.
 */

const frame = (n: number) => `/hero/variants/${String(n).padStart(2, "0")}.jpg`;
const nf = new Intl.NumberFormat("en-GB");
type Tab = "guest" | "host" | "wall";

export function ThreeScreens() {
  const [tab, setTab] = useState<Tab>("guest");
  const tabs: Array<[Tab, string]> = [
    ["guest", "Guest's phone"],
    ["host", "Your gallery"],
    ["wall", "On the projector"],
  ];

  return (
    <section id="demo" className="bg-ink text-linen">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-5 sm:py-20 lg:py-24">
        <Eyebrow className="text-rose-soft">See it work</Eyebrow>
        <h2 className="mt-3 text-[2.25rem] [word-spacing:0.1em] sm:text-[3.5rem]">
          One night, three screens.
        </h2>
        <p className="mt-4 max-w-2xl text-body text-linen/72 sm:text-lead">
          What your guests tap, what you keep, and what everyone watches on the
          wall.
        </p>

        <div
          role="tablist"
          aria-label="Screens"
          className="mt-8 inline-flex flex-wrap gap-1 rounded-2xl bg-linen/8 p-1"
        >
          {tabs.map(([key, label], i) => (
            <button
              key={key}
              id={`tab-${key}`}
              type="button"
              role="tab"
              aria-selected={tab === key}
              aria-controls={`panel-${key}`}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length][0];
                setTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              }}
              className={cx(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-small font-semibold transition-colors",
                tab === key ? "bg-chalk text-ink" : "text-linen/72 hover:text-linen",
              )}
            >
              {label}
              {key === "wall" && (
                <span
                  className={cx(
                    "rounded-full px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.14em]",
                    tab === key ? "bg-blush text-claret" : "bg-rose/20 text-rose-soft",
                  )}
                >
                  Pro
                </span>
              )}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-7">
          {tab === "guest" && <GuestPanel />}
          {tab === "host" && <HostPanel onSlideshow={() => setTab("wall")} />}
          {tab === "wall" && <WallPanel />}
        </div>
      </div>
    </section>
  );
}

/* --- Guest ----------------------------------------------------------------- */

interface Result {
  name: string;
  thumb?: string;
  before?: number;
  after?: number;
  format?: string;
  mp?: string;
  failed?: boolean;
}

const fmtSize = (b: number) =>
  b >= 100 * 1024 ? `${(b / 1024 ** 2).toFixed(b >= 10 * 1024 ** 2 ? 0 : 1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

const toBlob = (c: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob | null>((r) => c.toBlob(r, type, q));

async function compress(file: File) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 6000 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")?.drawImage(bmp, 0, 0, w, h);
  const mp = ((bmp.width * bmp.height) / 1e6).toFixed(1);
  bmp.close();
  // A canvas answers any type it is asked for and quietly hands back PNG
  // when it cannot, so check what actually came out (see lib/client/codec).
  let blob = await toBlob(c, "image/webp", 0.8);
  let format = "WebP";
  if (!blob || blob.type !== "image/webp") {
    blob = await toBlob(c, "image/jpeg", 0.82);
    format = "JPEG";
  }
  const t = document.createElement("canvas");
  const ts = 144 / Math.max(w, h);
  t.width = Math.max(1, Math.round(w * ts));
  t.height = Math.max(1, Math.round(h * ts));
  t.getContext("2d")?.drawImage(c, 0, 0, t.width, t.height);
  const thumb = t.toDataURL("image/jpeg", 0.72);
  c.width = c.height = 0;
  return { size: blob?.size ?? file.size, format, mp, thumb };
}

function GuestPanel() {
  const [results, setResults] = useState<Result[]>([]);
  const [over, setOver] = useState(false);

  async function handle(list: FileList | null) {
    const files = Array.from(list ?? [])
      .filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name))
      .slice(0, 8);
    if (!files.length) return;
    setResults(files.map((f) => ({ name: f.name })));
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      let next: Result;
      try {
        const out = await compress(f);
        next = {
          name: f.name,
          thumb: out.thumb,
          before: f.size,
          after: Math.min(out.size, f.size),
          format: out.size < f.size ? out.format : undefined,
          mp: out.mp,
        };
      } catch {
        next = { name: f.name, failed: true };
      }
      setResults((r) => r.map((x, j) => (j === i ? next : x)));
    }
  }

  const done = results.filter((r) => r.before !== undefined);
  const before = done.reduce((a, r) => a + (r.before ?? 0), 0);
  const after = done.reduce((a, r) => a + (r.after ?? 0), 0);
  const secs = (b: number) => Math.max(1, Math.round((b * 8) / 5e6));

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-14">
      <div>
        <h3 className="text-[1.75rem] [word-spacing:0.1em] sm:text-[2.25rem]">
          One button. That&apos;s the whole guest side.
        </h3>
        <ul className="mt-5 space-y-3.5">
          {[
            ["One photo or three hundred", "in a single tap."],
            ["Compressed on the phone first,", "so uploads finish on venue wifi."],
            ["Stuck inside Instagram or WhatsApp?", "The page says how to open the real browser."],
          ].map(([strong, rest]) => (
            <li key={strong} className="flex items-start gap-3 text-body leading-normal text-linen/72">
              <span className="mt-0.5 grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full bg-pine">
                <MdCheck aria-hidden className="text-[14px] text-chalk" />
              </span>
              <span>
                <b className="font-semibold text-linen">{strong}</b> {rest}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-[1.25rem] bg-paper p-5 text-ink shadow-[0_30px_60px_-28px_rgba(0,0,0,0.7)]">
        <h4
          className="font-display text-[1.375rem] font-extrabold leading-tight tracking-[-0.035em] [word-spacing:0.1em]"
          style={{ fontStretch: "82%" }}
        >
          Try the compression on your own photos
        </h4>
        <p className="mt-1.5 text-small text-ash">
          They&apos;re compressed here in your browser, the way a guest&apos;s phone
          does it. Nothing is uploaded.
        </p>
        <label
          htmlFor="own-photos"
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            handle(e.dataTransfer.files);
          }}
          className={cx(
            "relative mt-4 block cursor-pointer rounded-2xl px-5 py-7 text-center inset-shadow-well transition-colors focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-ink",
            over ? "bg-blush" : "bg-linen hover:bg-blush",
          )}
        >
          <span className="flex items-end justify-center gap-3">
            <Hole size={18} />
            <Hole size={30} />
            <Hole size={13} />
          </span>
          <span className="mt-3 block text-lead font-semibold leading-snug">
            Choose photos from this device
          </span>
          <span className="mt-1 block text-label text-ash">Or drop them here. Up to 8 at a time.</span>
          <input
            id="own-photos"
            type="file"
            accept="image/*"
            multiple
            className="absolute h-px w-px opacity-0"
            onChange={(e) => {
              handle(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {results.length > 0 && (
          <ul className="mt-3.5 space-y-2" aria-live="polite">
            {results.map((r, i) => (
              <li key={`${r.name}-${i}`} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-linen py-2 pl-2 pr-3">
                {r.thumb ? (
                  <img src={r.thumb} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <span className="recess h-12 w-12" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-[0.875rem] font-semibold">{r.name}</p>
                  <p className="font-mono text-micro text-mist">
                    {r.failed
                      ? "This browser can't open this file. A guest's iPhone converts it before sending."
                      : r.before === undefined
                        ? "Compressing…"
                        : r.format
                          ? `${fmtSize(r.before)} → ${fmtSize(r.after ?? 0)} · ${r.format} · ${r.mp} MP kept`
                          : `${fmtSize(r.before)} · already small, sent as it is`}
                  </p>
                </div>
                <span
                  className="font-display text-[1.2rem] font-extrabold tracking-[-0.03em] text-pine tabular-nums"
                  style={{ fontStretch: "86%" }}
                >
                  {r.failed
                    ? "-"
                    : r.before === undefined
                      ? "…"
                      : r.format
                        ? `−${Math.round((1 - (r.after ?? 0) / r.before) * 100)}%`
                        : "OK"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {done.length > 0 && done.length === results.filter((r) => !r.failed).length && (
          <p className="mt-3 rounded-xl bg-pine/8 px-3.5 py-3 text-small">
            <b className="tabular-nums">
              {done.length} photo{done.length > 1 ? "s" : ""}: {fmtSize(before)} → {fmtSize(after)}.
            </b>{" "}
            On a 5 Mbit/s venue connection that is{" "}
            <b className="tabular-nums">
              {secs(before)} s → {secs(after)} s
            </b>{" "}
            to send.
          </p>
        )}
      </div>
    </div>
  );
}

/* --- Host ------------------------------------------------------------------ */

const DASH_PHOTOS = [7, 2, 11, 10, 6, 1, 9, 4, 12, 5, 3, 8];
const DASH_VIDEOS: Array<[number, string]> = [
  [9, "0:14"],
  [2, "0:42"],
  [11, "1:07"],
  [1, "0:23"],
];

function HostPanel({ onSlideshow }: { onSlideshow: () => void }) {
  const [kind, setKind] = useState<"photos" | "videos">("photos");
  const [favs, setFavs] = useState<Set<number>>(() => new Set([7, 2]));
  const [favOnly, setFavOnly] = useState(false);
  const [viewer, setViewer] = useState<{ list: number[]; i: number } | null>(null);
  const [zip, setZip] = useState<number | null>(null);

  const items: Array<[number, string | null]> =
    kind === "photos" ? DASH_PHOTOS.map((n) => [n, null]) : DASH_VIDEOS;
  const shown = items.filter(([n]) => !favOnly || favs.has(n));

  async function packZip() {
    if (zip !== null) return;
    for (let p = 0; p <= 100; p += 5) {
      setZip(p);
      await new Promise((r) => setTimeout(r, 70));
    }
    await new Promise((r) => setTimeout(r, 2400));
    setZip(null);
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-paper text-ink shadow-[0_30px_70px_-30px_rgba(0,0,0,0.75)]">
        <div className="flex items-center gap-3 bg-blush px-3.5 py-2.5">
          <span aria-hidden className="flex gap-1.5">
            {[0, 1, 2].map((d) => (
              <span key={d} className="h-2.5 w-2.5 rounded-full bg-ink/18" />
            ))}
          </span>
          <span className="min-w-0 flex-1 truncate rounded-lg bg-paper px-2.5 py-1 font-mono text-[0.72rem] text-mist">
            shotandshare.com/dashboard/events/romeo-and-juliet
          </span>
        </div>

        <div className="relative bg-linen p-4.5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3.5">
            <div>
              <Eyebrow>Sat 13 June 2026 · Pro</Eyebrow>
              <h3 className="mt-1 text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)] [word-spacing:0.1em]">
                Romeo &amp; Juliet
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={packZip}>
                <MdOutlineFileDownload aria-hidden className="text-[1.25em]" />
                Download all
              </Button>
              <Button size="sm" variant="secondary" onClick={onSlideshow}>
                <MdOutlineSlideshow aria-hidden className="text-[1.25em]" />
                Slideshow
              </Button>
            </div>
          </div>

          <div className="mt-4.5 grid grid-cols-3 gap-2.5">
            {[
              ["1,342", "Photos"],
              ["36", "Videos"],
              ["9.4 GB", "of 30 GB"],
            ].map(([value, label], i) => (
              <div key={label} className="rounded-[0.875rem] bg-paper px-3.5 py-3 shadow-sm">
                <b
                  className="block font-display text-[clamp(1.25rem,1rem+1vw,1.75rem)] font-extrabold leading-tight tracking-[-0.035em] tabular-nums"
                  style={{ fontStretch: "86%" }}
                >
                  {value}
                </b>
                <span className="mt-0.5 block font-mono text-[0.66rem] uppercase tracking-[0.12em] text-mist">
                  {label}
                </span>
                {i === 2 && (
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-blush inset-shadow-well">
                    <span className="block h-full w-[31%] rounded-full bg-pine" />
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4.5 flex flex-wrap items-center justify-between gap-2.5">
            <div role="tablist" aria-label="Media type" className="inline-flex rounded-[0.875rem] bg-blush p-1 inset-shadow-well">
              {(["photos", "videos"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={kind === k}
                  onClick={() => setKind(k)}
                  className={cx(
                    "rounded-[0.625rem] px-3 py-1.5 text-[0.875rem] font-semibold capitalize transition-colors",
                    kind === k ? "bg-paper text-ink shadow-sm" : "text-ash",
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-micro uppercase tracking-[0.12em] text-mist">Newest first</span>
              <button
                type="button"
                aria-pressed={favOnly}
                onClick={() => setFavOnly((v) => !v)}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[0.875rem] font-semibold shadow-sm",
                  favOnly ? "bg-ink text-linen" : "bg-paper",
                )}
              >
                {favOnly ? <MdFavorite aria-hidden /> : <MdFavoriteBorder aria-hidden />}
                Favourites
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {shown.length === 0 && (
              <p className="col-span-full py-7 text-center text-small text-ash">
                Nothing here yet. Tap the heart on a {kind === "photos" ? "photo" : "video"} to keep it for the album.
              </p>
            )}
            {shown.map(([n, dur], idx) => {
              const fav = favs.has(n);
              return (
                <div key={n} className="recess group relative aspect-square overflow-hidden">
                  <button
                    type="button"
                    aria-label={`Open ${kind === "photos" ? "photo" : "video"} ${idx + 1}`}
                    onClick={() => setViewer({ list: shown.map(([m]) => m), i: idx })}
                    className="block h-full w-full cursor-zoom-in"
                  >
                    <Photo src={frame(n)} alt="" fill sizes="(min-width: 1024px) 160px, 30vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                  </button>
                  {dur && (
                    <span className="pointer-events-none absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-full bg-ink/60 py-0.5 pl-1 pr-2 font-mono text-[0.66rem] text-white">
                      <MdPlayArrow aria-hidden className="text-[14px]" />
                      {dur}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-pressed={fav}
                    aria-label="Favourite"
                    onClick={() =>
                      setFavs((s) => {
                        const next = new Set(s);
                        if (next.has(n)) next.delete(n);
                        else next.add(n);
                        return next;
                      })
                    }
                    className={cx(
                      "absolute right-1.5 top-1.5 grid h-8.5 w-8.5 place-items-center rounded-full transition-opacity [@media(hover:none)]:opacity-100",
                      fav ? "bg-ink/60 text-rose-soft opacity-100" : "bg-ink/40 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                    )}
                  >
                    {fav ? <MdFavorite aria-hidden /> : <MdFavoriteBorder aria-hidden />}
                  </button>
                </div>
              );
            })}
          </div>

          {zip !== null && (
            <div role="status" className="toast-in absolute bottom-4 left-1/2 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-[0.875rem] bg-ink px-3.5 py-2.5 text-[0.875rem] text-linen shadow-lg">
              <MdOutlineFileDownload aria-hidden className="text-[18px] text-rose-soft" />
              {zip < 100 ? (
                <>
                  <span>Packing romeo-and-juliet.zip</span>
                  <span className="h-1.5 w-28 overflow-hidden rounded-full bg-linen/20">
                    <span className="block h-full bg-rose-soft" style={{ width: `${zip}%` }} />
                  </span>
                </>
              ) : (
                <span>romeo-and-juliet.zip · {nf.format(1342)} photos · 36 videos. Ready.</span>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-[0.9375rem] text-linen/72">
        <b className="font-semibold text-linen">Your gallery.</b> Newest first,
        photos and videos apart, favourites for the album, and one ZIP with
        everything in it.
      </p>

      {viewer && <Viewer list={viewer.list} start={viewer.i} onClose={() => setViewer(null)} />}
    </div>
  );
}

function Viewer({ list, start, onClose }: { list: number[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const close = useRef<HTMLButtonElement>(null);
  const step = (d: number) => setI((x) => (x + d + list.length) % list.length);

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      back?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const round = "grid h-12 w-12 place-items-center rounded-full bg-chalk/14 text-chalk backdrop-blur hover:bg-chalk/26";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(14,10,11,0.93)] px-4 py-14"
    >
      <div className="relative h-[78vh] w-full max-w-[880px]">
        <Photo src={frame(list[i])} alt="" fill sizes="880px" className="object-contain" />
      </div>
      <button ref={close} type="button" aria-label="Close" onClick={onClose} className={cx(round, "absolute right-3 top-3")}>
        <MdClose aria-hidden className="text-[22px]" />
      </button>
      <button type="button" aria-label="Previous" onClick={() => step(-1)} className={cx(round, "absolute left-3 top-1/2 -translate-y-1/2")}>
        <MdChevronLeft aria-hidden className="text-[26px]" />
      </button>
      <button type="button" aria-label="Next" onClick={() => step(1)} className={cx(round, "absolute right-3 top-1/2 -translate-y-1/2")}>
        <MdChevronRight aria-hidden className="text-[26px]" />
      </button>
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-micro tracking-[0.14em] text-chalk/70">
        {i + 1} / {list.length}
      </p>
    </div>
  );
}

/* --- Projector --------------------------------------------------------------- */

const WALL = [2, 11, 9, 6, 4, 1, 10, 5, 12, 3, 8, 7];

function WallPanel() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const visible = useRef(true);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => visible.current && setI((x) => (x + 1) % WALL.length), 4200);
    return () => clearInterval(t);
  }, [playing]);

  const current = WALL[i];
  const recent = [0, 1, 2].map((k) => WALL[(i + WALL.length - k) % WALL.length]);
  const round = "grid h-10 w-10 place-items-center rounded-full bg-chalk/14 text-chalk backdrop-blur hover:bg-chalk/26";

  return (
    <div>
      <div
        ref={box}
        className="relative aspect-video overflow-hidden rounded-[0.875rem] bg-[#0e0a0b] shadow-[0_0_0_8px_#0b0809,0_40px_90px_-30px_rgba(0,0,0,0.9)]"
      >
        {/* A portrait photo on a landscape wall: the same picture, blurred,
            fills the sides rather than two black bars. */}
        <div
          aria-hidden
          className="absolute -inset-[12%] bg-cover bg-center blur-[38px] brightness-50 saturate-[1.15]"
          style={{ backgroundImage: `url(${frame(current)})` }}
        />
        <div key={current} className="tile-in absolute inset-0">
          <Photo src={frame(current)} alt="" fill sizes="(min-width: 1152px) 1100px, 100vw" className="slow-zoom object-contain" />
        </div>
        <p className="absolute left-3.5 top-3 inline-flex items-center gap-2 rounded-full bg-[rgba(14,10,11,0.55)] py-1.5 pl-2.5 pr-3 font-mono text-micro uppercase tracking-[0.14em] text-chalk backdrop-blur">
          <span className="live-dot !h-2 !w-2" aria-hidden />
          Live · Romeo &amp; Juliet
        </p>
        <div className="absolute bottom-3.5 left-3.5 flex gap-1.5">
          <button type="button" aria-label="Previous photo" onClick={() => setI((x) => (x + WALL.length - 1) % WALL.length)} className={round}>
            <MdChevronLeft aria-hidden className="text-[22px]" />
          </button>
          <button
            type="button"
            aria-label={playing ? "Pause slideshow" : "Play slideshow"}
            onClick={() => setPlaying((p) => !p)}
            className={round}
          >
            {playing ? <MdPause aria-hidden className="text-[22px]" /> : <MdPlayArrow aria-hidden className="text-[22px]" />}
          </button>
          <button type="button" aria-label="Next photo" onClick={() => setI((x) => (x + 1) % WALL.length)} className={round}>
            <MdChevronRight aria-hidden className="text-[22px]" />
          </button>
        </div>
        <div aria-hidden className="absolute bottom-3.5 right-3.5 flex items-center gap-1.5">
          <span className="mr-1 hidden font-mono text-[0.625rem] uppercase tracking-[0.14em] text-chalk/70 sm:inline">
            Just in
          </span>
          {recent.map((n) => (
            <span key={n} className="relative block aspect-square w-[clamp(34px,5vw,54px)] overflow-hidden rounded-lg shadow-[0_0_0_2px_rgba(253,246,247,0.8)]">
              <Photo src={frame(n)} alt="" fill sizes="54px" className="object-cover" />
            </span>
          ))}
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-[0.9375rem] text-linen/72">
        <b className="font-semibold text-linen">Pro.</b> Open the slideshow on
        any laptop plugged into the projector. New photos appear as guests send
        them, with no venue software.
      </p>
    </div>
  );
}
