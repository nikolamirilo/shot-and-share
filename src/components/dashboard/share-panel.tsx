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
  const [building, setBuilding] = useState(false);
  const { pending, error, setError, run } = useServerAction();

  /**
   * The card comes back as a PDF, and it is fetched rather than navigated to.
   * Pointing the window at the endpoint would download the file in the ordinary
   * case and replace the dashboard with a page of JSON in the one case that
   * matters - a link revoked in another tab since this panel was drawn. This
   * way that lands in the same Alert as everything else here.
   */
  async function downloadCard() {
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/qr?format=card`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "The card could not be built.");
        return;
      }
      const href = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = href;
      a.download =
        /filename="([^"]+)"/.exec(
          res.headers.get("content-disposition") ?? "",
        )?.[1] ?? "say-cheese-card.pdf";
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      setError("The card could not be built. Try again in a minute.");
    } finally {
      setBuilding(false);
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

              <div className="mt-3 flex flex-col items-center gap-2">
                <Button onClick={copy} size="sm" className="w-10/12 max-w-[250px]">
                  {copied ? "Copied" : "Copy link"}
                </Button>
                <Button
                  onClick={downloadCard}
                  variant="secondary"
                  size="sm"
                  disabled={building}
                  className="w-10/12 max-w-[250px]"
                >
                  {building
                    ? "Building…"
                    : brandedQr
                      ? "Download branded card"
                      : "Download the card"}
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
