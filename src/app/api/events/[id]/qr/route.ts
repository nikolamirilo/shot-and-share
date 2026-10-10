import { fail, handle } from "@/lib/api";
import { requireOwnedEvent } from "@/lib/host";
import { resolveAppearance } from "@/lib/appearance/resolve";
import { env } from "@/lib/env";
import { getActiveShareToken } from "@/lib/events";
import { codeColours, qrSvg } from "@/lib/qr";
import { shareUrl } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The event's QR code as SVG - vector, so it prints at any size.
 *
 * This is what the dashboard shows and what the host's PNG is rasterised from.
 * Colours come from the event's theme through the same resolver the guest page
 * uses, so a printed code matches the page guests land on.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;

    const event = await requireOwnedEvent(id);

    const active = await getActiveShareToken(event.id);
    if (!active) {
      return fail(
        "not_found",
        "This event has no active link. Issue a new one first.",
      );
    }

    const url = shareUrl(env.siteUrl, active.token);
    const colours = codeColours(resolveAppearance(event).palette);

    // The name the file lands under is the event's, because a host printing
    // three parties this month ends up with three of these in one folder.
    return new Response(qrSvg(url, { ...colours, pixels: 1024 }), {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${filename(event.name)}"`,
      },
    });
  });
}

/**
 * ASCII only, and quoted. A `Content-Disposition` header carrying a raw event
 * name is both an encoding problem and a header-injection one, and a host who
 * called their event "Ana & Marko ♥" should still get a file.
 */
function filename(eventName: string): string {
  const slug = eventName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `shot-and-share-${slug || "code"}.svg`;
}
