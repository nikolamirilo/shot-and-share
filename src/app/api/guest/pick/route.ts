import { z } from "zod";

import { handle, ok, parseBody } from "@/lib/api";
import { enforceRateLimit } from "@/lib/guards";
import { LIMITS, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(20).max(64),
  /** How many files the browser handed over for one tap of the button. */
  picked: z.number().int().min(0).max(10_000),
  /** How many of those the queue is going to send. */
  sending: z.number().int().min(0).max(10_000),
});

/**
 * How many files one tap of the picker actually produced, written to the log.
 *
 * This exists because of a bug we cannot see and cannot reproduce: on some
 * iPhones the photo sheet comes up without multi-select and the guest can only
 * hand over one file at a time, while the same page on the next iPhone is
 * fine. Whatever decides that lives in the operating system - so the only way
 * to find the pattern is to record what each device did, and the only thing
 * worth recording is the count beside the browser that produced it.
 *
 * It writes nothing down. The line goes to the request log and ages out with
 * it, which is the right lifetime for a number that stops being interesting
 * the moment the pattern is clear. The user agent is already in that log
 * against every request; this only puts the count next to it.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);

    // Same shape as the page-open beacon: one line per tap is nothing, and a
    // script hammering it is still only writing to a log.
    enforceRateLimit(
      LIMITS.guestPage,
      `pick:${clientIp(request.headers)}`,
      "Too many requests.",
    );

    // The token is not resolved: it identifies nothing here, and the point is
    // to hear from a device whose upload never started.
    console.info(
      `[pick] picked=${body.picked} sending=${body.sending} ua=${
        request.headers.get("user-agent")?.slice(0, 200) ?? "none"
      }`,
    );

    return ok({ logged: true });
  });
}
