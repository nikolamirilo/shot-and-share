import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";

/**
 * The half of the retention job that reclaims abandoned uploads.
 *
 * A guest whose phone dies between "sign me a URL" and "the bytes landed" costs
 * the host quota they cannot see and cannot free. This is the only thing that
 * gives it back, so the two cases that matter are: it does hand back what was
 * never delivered, and it does *not* touch a photo that is actually there.
 */

const store = createStore();
const removed: string[][] = [];

vi.mock("@/lib/env", () => ({
  env: { cronSecret: "secret", siteUrl: "http://localhost:3000" },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => store.client,
}));

vi.mock("@/lib/storage", () => ({
  storage: {
    remove: vi.fn(async (keys: string[]) => {
      removed.push(keys);
    }),
    removePrefix: vi.fn(async () => 0),
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => {}),
  retentionWarningEmail: vi.fn(() => ({})),
  eventExpiredEmail: vi.fn(() => ({})),
}));

const { POST } = await import("@/app/api/cron/retention/route");

const EVENT_ID = "11111111-2222-3333-4444-555555555555";
const OWNER_ID = "00000000-1111-2222-3333-444444444444";

const hoursAgo = (n: number) =>
  new Date(Date.now() - n * 3600_000).toISOString();

function reservation(id: string, createdAt: string) {
  return {
    id,
    event_id: EVENT_ID,
    owner_id: OWNER_ID,
    media_key: `${OWNER_ID}/${EVENT_ID}/${id}.webp`,
    poster_key: null,
    size_bytes: 900_000,
    poster_size_bytes: 0,
    media: {},
    created_at: createdAt,
  };
}

const run = () =>
  POST(
    new Request("http://localhost/api/cron/retention", {
      method: "POST",
      headers: { authorization: "Bearer secret" },
    }),
  );

beforeEach(() => {
  store.reset();
  removed.length = 0;
});

describe("sweeping abandoned uploads", () => {
  it("hands back the quota and removes the object", async () => {
    store
      .rows("upload_reservations")
      .push(reservation("aaaaaaaa-0000-0000-0000-000000000001", hoursAgo(5)));

    const res = await run();
    const body = await res.json();

    expect(body.reservationsSwept).toBe(1);
    expect(store.released()).toBe(900_000);
    expect(removed).toEqual([
      [`${OWNER_ID}/${EVENT_ID}/aaaaaaaa-0000-0000-0000-000000000001.webp`],
    ]);
    expect(store.rows("upload_reservations")).toHaveLength(0);
  });

  it("waits long enough for the largest clip any plan takes", async () => {
    // A 500 MB clip on genuinely bad wifi is a few hours, not one. Sweeping
    // its reservation at two would fail the upload at the finish line, after
    // the guest had waited the whole time.
    store
      .rows("upload_reservations")
      .push(reservation("aaaaaaaa-0000-0000-0000-000000000004", hoursAgo(3)));

    const body = await (await run()).json();

    expect(body.reservationsSwept).toBe(0);
    expect(store.rows("upload_reservations")).toHaveLength(1);
  });

  /**
   * The dangerous case. A confirm that wrote the media row and then failed to
   * delete its own reservation leaves one pointing at a photo the host can see
   * in their gallery. Sweeping it the old way would delete the object and
   * refund bytes that are genuinely in use - somebody's wedding photo,
   * disappearing overnight with nothing in the logs to say why.
   */
  it("never removes the object when the photo actually exists", async () => {
    const id = "aaaaaaaa-0000-0000-0000-000000000003";
    store.rows("upload_reservations").push(reservation(id, hoursAgo(5)));
    store.rows("media").push({
      id,
      event_id: EVENT_ID,
      status: "ready",
      media_key: `${OWNER_ID}/${EVENT_ID}/${id}.webp`,
    });

    const body = await (await run()).json();

    expect(removed).toEqual([]);
    expect(store.released()).toBe(0);
    expect(body.reservationsSwept).toBe(0);
    // The stale reservation is still tidied away, just harmlessly.
    expect(store.rows("upload_reservations")).toHaveLength(0);
    expect(store.rows("media")).toHaveLength(1);
  });

  it("refuses without the cron secret", async () => {
    const res = await POST(
      new Request("http://localhost/api/cron/retention", { method: "POST" }),
    );
    expect(res.status).toBe(401);
  });
});
