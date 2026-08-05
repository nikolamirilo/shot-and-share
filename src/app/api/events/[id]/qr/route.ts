import { ApiError, fail, handle } from "@/lib/api";
import { env } from "@/lib/env";
import { getActiveShareToken } from "@/lib/events";
import { qrCardSvg, qrSvg } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";
import { getTier } from "@/lib/tiers";
import { shareUrl } from "@/lib/tokens";
import type { EventRow } from "@/lib/db/types";

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

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError("unauthorized", "Sign in first.");

    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!data) throw new ApiError("not_found", "Event not found.");
    const event = data as EventRow;

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
