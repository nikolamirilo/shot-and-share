import { fail, handle } from "@/lib/api";
import { requireOwnedEvent } from "@/lib/host";
import { resolveAppearance } from "@/lib/appearance/resolve";
import { env } from "@/lib/env";
import { getActiveShareToken } from "@/lib/events";
import { cardColours, qrCardPdf, qrSvg } from "@/lib/qr";
import { getTier } from "@/lib/tiers";
import { shareUrl } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The QR code is the actual product - the thing that goes on the table - so
 * both formats are vector and print at any size without pixelation.
 *
 * `format=code` is the bare code as SVG, which is what the dashboard shows and
 * what the host's PNG is rasterised from in the browser.
 * `format=card` is the printable A5 card, and it is a PDF that downloads rather
 * than an image that opens: the host is on the way to a printer, and a PDF page
 * box is the only way to say "this is A5" and be believed. The Wedding tier
 * gets the branded version of it.
 *
 * Both take their colours from the event's own theme, through the same resolver
 * the guest page uses - so the card a host prints matches the page their guests
 * land on, and a free event gets the house palette whatever is in its row.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const format = new URL(request.url).searchParams.get("format") ?? "card";

    const event = await requireOwnedEvent(id);

    const active = await getActiveShareToken(event.id);
    if (!active) {
      return fail(
        "not_found",
        "This event has no active link. Issue a new one first.",
      );
    }

    const url = shareUrl(env.siteUrl, active.token);
    const tier = getTier(event.tier);
    const colours = cardColours(
      resolveAppearance(event).palette,
      tier.brandedQr,
    );

    if (format === "code") {
      return new Response(qrSvg(url, { ...colours, pixels: 1024 }), {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "private, no-store",
          "Content-Disposition": `inline; filename="${filename(event.name, "svg")}"`,
        },
      });
    }

    const pdf = await qrCardPdf(url, { eventName: event.name, colours });

    // The name the file lands under is the event's, because a host printing
    // three parties this month ends up with three of these in one folder.
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename(event.name, "pdf")}"`,
      },
    });
  });
}

/**
 * ASCII only, and quoted. A `Content-Disposition` header carrying a raw event
 * name is both an encoding problem and a header-injection one, and a host who
 * called their event "Ana & Marko ♥" should still get a file.
 */
function filename(eventName: string, extension: string): string {
  const slug = eventName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `shot-and-share-${slug || "card"}.${extension}`;
}
