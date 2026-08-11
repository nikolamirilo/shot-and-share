"use client";

import { useState } from "react";

import { useServerAction } from "@/hooks/use-server-action";

import { revokeShareLink, rotateShareLink } from "@/lib/actions/share-links";
import { Alert, Button, Panel } from "@/components/ui";

/**
 * The share panel is the product. A host should be able to get the code onto a
 * table in under a minute, from a phone, standing in a venue.
 */
export function SharePanel({
  eventId,
  link,
  brandedQr,
  revoked,
}: {
  eventId: string;
  link: string | null;
  brandedQr: boolean;
  revoked: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"card" | "png" | null>(null);
  const { pending, error, setError, run } = useServerAction();

  /**
   * The card comes back as a PDF, and it is fetched rather than navigated to.
   * Pointing the window at the endpoint would download the file in the ordinary
   * case and replace the dashboard with a page of JSON in the one case that
   * matters - a link revoked in another tab since this panel was drawn. This
   * way that lands in the same Alert as everything else here.
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
   * The code on its own, as a PNG, for the host who is putting it in their own
   * invitation rather than printing ours.
   *
   * The server draws it once, as SVG, and the browser rasterises that - so the
   * PNG is the same artwork the panel is showing rather than a second renderer's
   * version of it, and the endpoint stays a single vector source. 1024px is big
   * enough to print a code the size of a beer mat.
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

  function revoke() {
    run(() => revokeShareLink(eventId), {
      confirm:
        "Turn this link off? Every printed code stops working immediately.",
    });
  }

  return (
    <Panel title="Share it">

      {revoked ? (
        <>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ash">
            There is no active link for this event. Guests who scan an old code
            see a page telling them the link has closed.
          </p>
          <Button onClick={rotate} disabled={pending} className="mt-5 w-full sm:w-auto">
            {pending ? "Issuing…" : "Issue a new link"}
          </Button>
        </>
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-[150px_1fr] sm:items-start sm:gap-5">
            {/* Same SVG the printable card embeds, so what is on screen is
                exactly what comes out of the printer.

                Capped and centred on a phone. Stretched across the full width
                of a stacked column it is a 340px square that pushes the link
                and both buttons below the fold, and nobody scans a code off
                the screen it was generated on. */}
            <div className="mx-auto w-full max-w-[168px] rounded-xl bg-paper p-2 shadow-md sm:mx-0 sm:max-w-none">
              <img
                src={`/api/events/${eventId}/qr?format=code`}
                alt="QR code for this event"
                className="w-full"
                width={512}
                height={512}
              />
            </div>

            <div>

              {/* Three things a host does with a code, in the order they do
                  them: send the link, print our card, or take the code away and
                  put it in something of their own. */}
              <div className="mt-3 flex flex-col items-center gap-2">
                <Button onClick={copy} size="sm" className="w-10/12 max-w-[250px]">
                  {copied ? "Copied" : "Copy link"}
                </Button>
                <Button
                  onClick={downloadCard}
                  variant="secondary"
                  size="sm"
                  disabled={busy !== null}
                  className="w-10/12 max-w-[250px]"
                >
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
                  className="w-10/12 max-w-[250px]"
                >
                  {busy === "png" ? "Saving…" : "Download the code (PNG)"}
                </Button>
              </div>
            </div>
          </div>

          <p className="mt-5 text-[0.8125rem] leading-relaxed text-mist">
            Print the card and put one on every table. Guests point a camera at
            it - that is the whole instruction, and it is worth resisting the urge
            to add more.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button
              onClick={rotate}
              variant="secondary"
              size="sm"
              disabled={pending}
            >
              Reissue link
            </Button>
            <Button
              onClick={revoke}
              variant="ghost"
              size="sm"
              disabled={pending}
            >
              Turn the link off
            </Button>
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
 * An SVG through a canvas and out as a PNG.
 *
 * The image has to have finished decoding before it is drawn - a canvas will
 * happily paint nothing at all from an <img> that is not ready and report no
 * error - and the SVG has to arrive as an object URL rather than as markup, so
 * that the canvas stays untainted and `toBlob` is allowed to read it back.
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
