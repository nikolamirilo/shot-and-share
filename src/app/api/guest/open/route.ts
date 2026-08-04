import { z } from "zod";

import { handle, ok, parseBody } from "@/lib/api";
import { resolveGuestToken } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ token: z.string().min(20).max(64) });

/**
 * Counts a guest opening the link.
 *
 * It is a separate beacon rather than a side effect of rendering the page for
 * two reasons: a Server Component cannot write the cookie that would keep it
 * to one count per visitor, and counting every render would fold in prefetches
 * and link previews. The client only fires this once per browser per event.
 *
 * The number this feeds - opened the link, then uploaded - is the clearest
 * signal we have that the guest experience is broken, so it is worth getting
 * approximately right rather than precisely wrong.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);
    const ctx = await resolveGuestToken(body.token);
    if (!ctx) return ok({ counted: false });

    const admin = createAdminClient();
    await admin.rpc("increment_link_opens", { p_event: ctx.event.id });
    return ok({ counted: true });
  });
}
