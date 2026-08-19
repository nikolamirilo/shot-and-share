import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";
import { TIERS } from "@/lib/tiers";

/**
 * The report button.
 *
 * An acceptable use policy promising a takedown route is worth nothing if the
 * route is an email address nobody at a party will type. What has to hold: the
 * photograph comes down before anyone decides anything, two people reporting
 * the same one is not an error, and a failed email does not turn a successful
 * report into one.
 */

const store = createStore();
const sendEmail = vi.fn(async (_email: Record<string, unknown>) => true);

const EVENT = {
  id: "11111111-2222-3333-4444-555555555555",
  owner_id: "00000000-1111-2222-3333-444444444444",
  name: "A wedding",
  tier: TIERS.plus.id,
  status: "active",
  expires_at: null,
  gallery_visible: true,
};

vi.mock("@/lib/guards/guest-token", () => ({
  resolveGuestToken: vi.fn(async () => ({ event: EVENT, tokenId: "t" })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => store.client,
}));

vi.mock("@/lib/email", () => ({
  sendEmail: (email: Record<string, unknown>) => sendEmail(email),
  photoReportedEmail: (args: Record<string, unknown>) => args,
}));

const { POST } = await import("@/app/api/guest/report/route");

const TOKEN = "t".repeat(32);
const MEDIA_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function report(mediaId = MEDIA_ID, reason = "someone_in_it") {
  return POST(
    new Request("http://localhost/api/guest/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // A fresh address per test, so the rate limiter is not carrying state
        // between them.
        "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
      },
      body: JSON.stringify({ token: TOKEN, mediaId, reason }),
    }),
  );
}

function seedPhoto(over: Record<string, unknown> = {}) {
  store.rows("media").push({
    id: MEDIA_ID,
    event_id: EVENT.id,
    owner_id: EVENT.owner_id,
    media_key: `${EVENT.owner_id}/${EVENT.id}/${MEDIA_ID}.jpg`,
    source: "guest",
    review_state: "approved",
    reported_at: null,
    report_count: 0,
    status: "ready",
    created_at: "2026-08-01T00:00:00.000Z",
    ...over,
  });
}

const photo = () => store.rows("media")[0];

beforeEach(() => {
  store.reset();
  sendEmail.mockClear();
  store.rows("profiles").push({
    id: EVENT.owner_id,
    email: "host@example.com",
  });
});

describe("reporting a photo", () => {
  it("hides it immediately", async () => {
    seedPhoto();

    const res = await report();

    expect(res.status).toBe(200);
    expect(photo().review_state).toBe("reported");
    expect(photo().reported_at).not.toBeNull();
  });

  it("tells the host, because they are the only one who can act", async () => {
    seedPhoto();
    await report();

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({
      to: "host@example.com",
      eventName: "A wedding",
    });
  });

  /*
   * Two guests pressing the button on the same photograph within a second of
   * each other is the normal case, not a conflict. The second must not be told
   * they got it wrong.
   */
  it("counts a second report without complaining", async () => {
    seedPhoto();
    await report();
    const first = photo().reported_at;

    const res = await report();

    expect(res.status).toBe(200);
    expect(photo().report_count).toBe(2);
    // The first report's timestamp is the one that means something.
    expect(photo().reported_at).toBe(first);
  });

  it("refuses a photo that is not on this event", async () => {
    seedPhoto({ event_id: "99999999-8888-7777-6666-555555555555" });

    const res = await report();

    expect(res.status).toBe(404);
    expect(photo().review_state).toBe("approved");
  });

  it("still reports when the host has no email to send to", async () => {
    store.reset();
    seedPhoto();

    const res = await report();

    expect(res.status).toBe(200);
    expect(photo().review_state).toBe("reported");
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
