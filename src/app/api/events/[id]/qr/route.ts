import { fail, handle } from "@/lib/api";
import { requireOwnedEvent } from "@/lib/guards/host-api";
import { resolveAppearance } from "@/lib/appearance/resolve";
import { env } from "@/lib/env";
import { getActiveShareToken } from "@/lib/events";
import { codeColours, qrSvg } from "@/lib/qr";
import { shareUrl } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    return new Response(qrSvg(url, { ...colours, pixels: 1024 }), {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${filename(event.name)}"`,
      },
    });
  });
}

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
