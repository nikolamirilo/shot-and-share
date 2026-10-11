import { z } from "zod";

import { handle, ok, parseBody } from "@/lib/api";
import { enforceRateLimit } from "@/lib/guards/rate-limit";
import { LIMITS } from "@/constants/limits";
import { clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(20).max(64),
  picked: z.number().int().min(0).max(10_000),
  sending: z.number().int().min(0).max(10_000),
});

export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);

    enforceRateLimit(
      LIMITS.guestPage,
      `pick:${clientIp(request.headers)}`,
      "Too many requests.",
    );

    console.info(
      `[pick] picked=${body.picked} sending=${body.sending} ua=${
        request.headers.get("user-agent")?.slice(0, 200) ?? "none"
      }`,
    );

    return ok({ logged: true });
  });
}
