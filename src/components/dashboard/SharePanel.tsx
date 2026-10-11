"use client";

import { useState } from "react";
import {
  MdOutlineAutorenew,
  MdOutlineCheck,
  MdOutlineContentCopy,
  MdOutlineFileDownload,
  MdOutlineLinkOff,
  MdOutlineOpenInNew,
} from "react-icons/md";

import { useServerAction } from "@/hooks/useServerAction";

import { revokeShareLink, rotateShareLink } from "@/lib/actions/share-links";
import { Alert, Button, ButtonLink, Panel, Stat, cx } from "@/components/ui";
import { pluralise } from "@/utils/format";

export function SharePanel({
  eventId,
  link,
  revoked,
  opens,
  uploaders,
}: {
  eventId: string;
  link: string | null;
  revoked: boolean;
  opens: number;
  uploaders: number;
}) {
  const [copied, setCopied] = useState(false);
  const [codeReady, setCodeReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const { pending, error, setError, run } = useServerAction();

  const conversion =
    opens > 0 ? Math.min(100, Math.round((uploaders / opens) * 100)) : null;

  async function downloadPng() {
    setSaving(true);
    setError(null);
    let objectUrl: string | null = null;
    try {
      const res = await fetch(`/api/events/${eventId}/qr`);
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
      setSaving(false);
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
          <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-ash">
            There is no active link for this event. Guests who scan an old code
            see a page telling them the link has closed.
          </p>
          <Button onClick={rotate} disabled={pending} className="mt-5 w-full sm:w-auto">
            <MdOutlineAutorenew aria-hidden className="shrink-0 text-[1.25em]" />
            {pending ? "Issuing…" : "Issue a new link"}
          </Button>
        </>
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-start sm:gap-5 lg:grid-cols-[8.5rem_16rem_minmax(0,1fr)] lg:gap-6">
            <div className="mx-auto aspect-square w-10/12 max-w-[250px] rounded-xl bg-paper p-2 shadow-md sm:mx-0 sm:size-[8.5rem] sm:max-w-none">
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
                <img
                  src={`/api/events/${eventId}/qr`}
                  alt="QR code for this event"
                  className={cx(
                    "size-full transition-opacity duration-200",
                    codeReady ? "opacity-100" : "opacity-0",
                  )}
                  width={512}
                  height={512}
                  onLoad={() => setCodeReady(true)}
                  onError={() => setCodeReady(true)}
                />
              </div>
            </div>

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
              {link && (
                <ButtonLink
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  variant="secondary"
                  size="sm"
                  className="w-10/12 max-w-[250px] sm:w-full sm:max-w-none"
                >
                  <MdOutlineOpenInNew aria-hidden className="shrink-0 text-[1.25em]" />
                  Go to the Event
                </ButtonLink>
              )}
              <Button
                onClick={downloadPng}
                variant="secondary"
                size="sm"
                disabled={saving}
                className="w-10/12 max-w-[250px] sm:w-full sm:max-w-none"
              >
                <MdOutlineFileDownload aria-hidden className="shrink-0 text-[1.25em]" />
                {saving ? "Saving…" : "Download the code (PNG)"}
              </Button>
            </div>

            <p className="mt-1 text-[0.8125rem] leading-relaxed text-mist sm:mt-0 sm:col-span-2 lg:col-span-1 lg:border-l lg:border-edge lg:pl-6">
              Print the code and put one on every table. Guests point a camera
              at it - that is the whole instruction, and it is worth resisting
              the urge to add more.
            </p>
          </div>

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

async function reason(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? fallback;
}

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
