import { fail, handle } from "@/lib/api";
import { requireOwnedEvent } from "@/lib/host";
import { resolveAppearance } from "@/lib/appearance/resolve";
import { env } from "@/lib/env";
import { getActiveShareToken } from "@/lib/events";
import { formatEventDate } from "@/lib/format";
import { cardColours, qrCardPdf, qrSvg } from "@/lib/qr";
import { getTier } from "@/lib/tiers";
import { shareUrl } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Both formats are vector, so they print at any size.
 *
 * `format=code` is the bare SVG the dashboard shows. `format=card` is the
 * printable A5 card as a PDF rather than an image: a PDF page box is the only
 * way to say "this is A5" and be believed.
 *
 * Colours come from the event's theme through the same resolver the guest page
 * uses, so the printed card matches the page guests land on.
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

    const pdf = await qrCardPdf(url, {
      eventName: event.name,
      eventDate: formatEventDate(event.event_date),
      colours,
    });

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
