import { z } from "zod";

import { handle, ok, parseBody } from "@/lib/api";
import { resolveGuestToken } from "@/lib/guards/guest";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ token: z.string().min(20).max(64) });

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
