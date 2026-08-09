import { fail, handle } from "@/lib/api";
import { requireOwnedEvent } from "@/lib/host";
import { env } from "@/lib/env";
import { getActiveShareToken } from "@/lib/events";
import { qrCardSvg, qrSvg } from "@/lib/qr";
import { getTier } from "@/lib/tiers";
import { shareUrl } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The QR code is the actual product - the thing that goes on the table - so it
 * is generated as SVG and prints at any size without pixelation.
 *
 * `format=code` is the bare code for a host who wants to place it themselves.
 * `format=card` is the printable A5 card; the Wedding tier gets the branded
 * version of it.
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

    const svg =
      format === "code"
        ? await qrSvg(url, 1024)
        : await qrCardSvg(url, {
            eventName: event.name,
            shortUrl: url,
            branded: tier.brandedQr,
          });

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="say-cheese-${format}.svg"`,
      },
    });
  });
}
