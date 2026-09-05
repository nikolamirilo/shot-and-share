"use client";

import { type FormEvent, useState } from "react";
import {
  MdOutlineAutorenew,
  MdOutlineCheck,
  MdOutlineContentCopy,
  MdOutlineFileDownload,
  MdOutlineLinkOff,
  MdOutlineLockReset,
} from "react-icons/md";

import { useServerAction } from "@/hooks/use-server-action";

import {
  restoreShareLink,
  revokeShareLink,
  rotateShareLink,
} from "@/lib/actions/share-links";
import {
  Alert,
  Button,
  Field,
  Panel,
  Stat,
  cx,
  inputClass,
} from "@/components/ui";
import { pluralise } from "@/lib/format";

/**
 * The share panel is the product. A host should be able to get the code onto a
 * table in under a minute, from a phone, standing in a venue.
 */
export function SharePanel({
  eventId,
  link,
  brandedQr,
  state,
  opens,
  uploaders,
}: {
  eventId: string;
  link: string | null;
  brandedQr: boolean;
  /**
   * "unreadable" is a link that is still live for guests but that we cannot
   * display - see `getShareLinkState`. It is deliberately not folded into
   * "none": the two need opposite buttons.
   */
  state: "active" | "unreadable" | "none";
  /** Times the link has been opened, and how many of those ended in an upload. */
  opens: number;
  uploaders: number;
}) {
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [codeReady, setCodeReady] = useState(false);
  const [busy, setBusy] = useState<"card" | "png" | null>(null);
  const { pending, error, setError, run } = useServerAction();

  const conversion =
    opens > 0 ? Math.min(100, Math.round((uploaders / opens) * 100)) : null;

  /**
   * Fetched rather than navigated to: pointing the window at the endpoint
   * replaces the dashboard with a page of JSON in the case that matters - a
   * link revoked in another tab since this panel was drawn.
   */
  async function downloadCard() {
    setBusy("card");
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/qr?format=card`);
      if (!res.ok) {
        setError(await reason(res, "The card could not be built."));
        return;
      }
      save(await res.blob(), named(res, "shot-and-share-card.pdf"));
    } catch {
      setError("The card could not be built. Try again in a minute.");
    } finally {
      setBusy(null);
    }
  }

  /**
   * The code alone, for a host putting it in their own invitation. The server
   * draws it once as SVG and the browser rasterises that, so the PNG is the
   * same artwork the panel shows. 1024px prints at beer-mat size.
   */
  async function downloadPng() {
    setBusy("png");
    setError(null);
    let objectUrl: string | null = null;
    try {
      const res = await fetch(`/api/events/${eventId}/qr?format=code`);
      if (!res.ok) {
        setError(await reason(res, "The code could not be built."));
        return;
      }
      objectUrl = URL.createObjectURL(
        new Blob([await res.text()], { type: "image/svg+xml" }),
      );
      const png = await rasterise(objectUrl, 1024);
      save(png, named(res, "shot-and-share-code.svg").replace(/\.svg$/, ".png"));
    } catch {
      setError("The code could not be saved. Try again in a minute.");
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBusy(null);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("Could not reach the clipboard. Select the link and copy it.");
    }
  }

  function rotate() {
    run(() => rotateShareLink(eventId));
  }

  function restore(event: FormEvent) {
    event.preventDefault();
    run(() => restoreShareLink(eventId, pasted), {
      onSuccess: () => setPasted(""),
    });
  }

  function revoke() {
    run(() => revokeShareLink(eventId), {
      confirm:
        "Turn this link off? Every printed code stops working immediately.",
    });
  }

  return (
    <Panel title="Share it">

      {state === "none" ? (
        <>
          <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-ash">
            There is no active link for this event. Guests who scan an old code
            see a page telling them the link has closed.
          </p>
          <Button onClick={rotate} disabled={pending} className="mt-5 w-full sm:w-auto">
            <MdOutlineAutorenew aria-hidden className="shrink-0 text-[1.25em]" />
            {pending ? "Issuing…" : "Issue a new link"}
          </Button>
        </>
      ) : state === "unreadable" ? (
        /* The link works and we cannot read it. Everything here is arranged
           around not letting a host reach for "Issue a new link", which would
           turn a page that cannot show a code into tables of codes that no
           longer work. */
        <>
          <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-ash">
            <strong>This event&rsquo;s link still works.</strong> Guests who
            scan a printed code get through as usual - we just cannot show the
            link on this page, because the key that encrypts links changed after
            this one was issued.
          </p>
          <p className="mt-2 max-w-prose text-[0.9375rem] leading-relaxed text-ash">
            Paste the link back in and the code, the card and the download
            buttons all return. Find it in a printed card, a message you sent
            guests, or your browser history.
          </p>

          <form onSubmit={restore} className="mt-5 max-w-prose">
            <Field label="Your event link" htmlFor="restore-link">
              <input
                id="restore-link"
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="https://www.shotandshare.com/e/…"
                className={inputClass}
              />
            </Field>
            <Button
              type="submit"
              disabled={pending || pasted.trim().length === 0}
              className="mt-3 w-full sm:w-auto"
            >
              <MdOutlineLockReset aria-hidden className="shrink-0 text-[1.25em]" />
              {pending ? "Restoring…" : "Restore this link"}
            </Button>
          </form>

          <div className="mt-6 border-t border-edge pt-5">
            <p className="max-w-prose text-[0.8125rem] leading-relaxed text-mist">
              Cannot find it anywhere? Issuing a new link is the last resort:
              every card already on a table stops working the moment you do.
            </p>
            <Button
              onClick={rotate}
              variant="ghost"
              size="sm"
              disabled={pending}
              className="mt-3"
            >
              <MdOutlineAutorenew aria-hidden className="shrink-0 text-[1.25em]" />
              Issue a new link instead
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* The two halves are measured off each other. Side by side the code
              takes the buttons' height: three `sm` buttons at 2.5rem with
              0.5rem gaps is 8.5rem, so change the size or count and this
              number changes with it.

              A laptop takes a third column rather than a wider second one. The
              code and its buttons are already the size they need to be, and a
              `1fr` column with a 16rem button in the middle of it is half a
              panel of nothing - so the room left over goes to the instruction,
              which is the only thing here that wants a line length. */}
          <div className="mt-5 grid gap-4 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-start sm:gap-5 lg:grid-cols-[8.5rem_16rem_minmax(0,1fr)] lg:gap-6">
            <div className="mx-auto aspect-square w-10/12 max-w-[250px] rounded-xl bg-paper p-2 shadow-md sm:mx-0 sm:size-[8.5rem] sm:max-w-none">
              {/* Generated per request, so on a slow connection this box is
                  briefly empty - and an empty white square here reads as "there
                  is no code" rather than "not yet". Three corners and a field
                  is the part of a QR a person recognises first. */}
              <div className="relative size-full">
                {!codeReady && (
                  <div
                    aria-hidden
                    className="absolute inset-0 animate-pulse rounded-md bg-blush"
                  >
                    <span className="absolute top-[8%] left-[8%] size-[26%] rounded-[0.3rem] border-[0.35rem] border-edge" />
                    <span className="absolute top-[8%] right-[8%] size-[26%] rounded-[0.3rem] border-[0.35rem] border-edge" />
                    <span className="absolute bottom-[8%] left-[8%] size-[26%] rounded-[0.3rem] border-[0.35rem] border-edge" />
                  </div>
                )}
                {/* Same plan the printable card is drawn from. */}
                <img
                  src={`/api/events/${eventId}/qr?format=code`}
                  alt="QR code for this event"
                  className={cx(
                    "size-full transition-opacity duration-200",
                    codeReady ? "opacity-100" : "opacity-0",
                  )}
                  width={512}
                  height={512}
                  onLoad={() => setCodeReady(true)}
                  /* A failed code must not leave a skeleton pulsing forever. */
                  onError={() => setCodeReady(true)}
                />
              </div>
            </div>

            {/* In the order a host does them: send the link, print our card,
                or take the code into something of their own. Centred under the
                code on a phone; from `sm` they line up with its left edge and
                stop growing, because a 40rem-wide "Copy link" is not a better
                button than a 16rem one. */}
            <div className="flex flex-col items-center gap-2 sm:max-w-64 sm:items-stretch">
              <Button
                onClick={copy}
                size="sm"
                className="w-10/12 max-w-[250px] sm:w-full sm:max-w-none"
              >
                {copied ? (
                  <MdOutlineCheck aria-hidden className="shrink-0 text-[1.25em]" />
                ) : (
                  <MdOutlineContentCopy aria-hidden className="shrink-0 text-[1.25em]" />
                )}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button
                onClick={downloadCard}
                variant="secondary"
                size="sm"
                disabled={busy !== null}
                className="w-10/12 max-w-[250px] sm:w-full sm:max-w-none"
              >
                <MdOutlineFileDownload aria-hidden className="shrink-0 text-[1.25em]" />
                {busy === "card"
                  ? "Building…"
                  : brandedQr
                    ? "Download branded card"
                    : "Download the card"}
              </Button>
              <Button
                onClick={downloadPng}
                variant="secondary"
                size="sm"
                disabled={busy !== null}
                className="w-10/12 max-w-[250px] sm:w-full sm:max-w-none"
              >
                <MdOutlineFileDownload aria-hidden className="shrink-0 text-[1.25em]" />
                {busy === "png" ? "Saving…" : "Download the code (PNG)"}
              </Button>
            </div>

            {/* Under both of them on a phone, beside both on a laptop - which
                is why it is in the grid rather than after it. The extra top
                margin below `sm` makes up the difference between the grid's own
                gap and the margin this had when it stood outside. */}
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-mist sm:mt-0 sm:col-span-2 lg:col-span-1 lg:border-l lg:border-edge lg:pl-6">
              Print the card and put one on every table. Guests point a camera
              at it - that is the whole instruction, and it is worth resisting
              the urge to add more.
            </p>
          </div>

          {/* About the link rather than the party, which is why they sit here:
              a guest who scans and does not upload is the clearest signal the
              card is not working, and it only reads next to the card.

              The two numbers and the two things you can do to the link are one
              footer on a laptop rather than two stacked rows - the numbers keep
              their own measure and the controls take the end of the line. */}
          <div className="mt-6 border-t border-edge pt-5 lg:flex lg:items-end lg:justify-between lg:gap-8">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:max-w-md lg:flex-1">
              <Stat label="Link opened" value={pluralise(opens, "time")} />
              <Stat
                label="Opened then uploaded"
                value={conversion === null ? "-" : `${conversion}%`}
                hint={
                  conversion === null
                    ? "No opens yet"
                    : conversion < 40
                      ? "Low. Check the code is easy to reach."
                      : "Healthy"
                }
              />
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 lg:mt-0 lg:shrink-0">
              <Button
                onClick={rotate}
                variant="secondary"
                size="sm"
                disabled={pending}
              >
                <MdOutlineAutorenew aria-hidden className="shrink-0 text-[1.25em]" />
                Reissue link
              </Button>
              <Button
                onClick={revoke}
                variant="ghost"
                size="sm"
                disabled={pending}
              >
                <MdOutlineLinkOff aria-hidden className="shrink-0 text-[1.25em]" />
                Turn the link off
              </Button>
            </div>
          </div>
        </>
      )}

      {error && <Alert className="mt-4">{error}</Alert>}
    </Panel>
  );
}

/** The API's own message where there is one, rather than a generic apology. */
async function reason(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? fallback;
}

/** The filename the endpoint chose, which is built from the event's name. */
function named(res: Response, fallback: string): string {
  return (
    /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ??
    fallback
  );
}

function save(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

/**
 * An SVG through a canvas and out as a PNG. The image must have finished
 * decoding first - a canvas paints nothing from an <img> that is not ready and
 * reports no error - and the SVG must arrive as an object URL, or the canvas is
 * tainted and `toBlob` refuses to read it back.
 */
function rasterise(svgUrl: string, pixels: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("The code could not be drawn."));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pixels;
      canvas.height = pixels;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas."));
      ctx.drawImage(img, 0, 0, pixels, pixels);
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("The PNG came back empty.")),
        "image/png",
      );
    };
    img.src = svgUrl;
  });
}
