import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";
import { TIERS } from "@/lib/tiers";

/**
 * What guests are shown.
 *
 * A cover the host uploaded lives in the same table, the same event folder and
 * the same quota as a guest's photograph, and one column apart from it. If that
 * column is ever forgotten in a query the failure is quiet and embarrassing: a
 * stock picture the host chose as decoration is handed back to the party as one
 * of their own photos, and it downloads in their ZIP.
 */

const store = createStore();

const EVENT = {
  id: "11111111-2222-3333-4444-555555555555",
  owner_id: "00000000-1111-2222-3333-444444444444",
  tier: TIERS.plus.id,
  status: "active",
  expires_at: null,
  gallery_visible: true,
};

// The database lookup is stubbed; the gate and the gallery-visibility rules
// around it are the real ones.
vi.mock("@/lib/guards/guest-token", () => ({
  resolveGuestToken: vi.fn(async () => ({ event: EVENT, tokenId: "t" })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => store.client,
}));

vi.mock("@/lib/storage", () => ({
  storage: {
    publicUrl: (key: string) => `https://cdn.example/${key}`,
    presignDownload: vi.fn(async ({ key }: { key: string }) =>
      `https://signed.example/${key}`,
    ),
  },
}));

const { GET } = await import("@/app/api/gallery/route");

function push(id: string, source: "guest" | "cover", minute: number) {
  store.rows("media").push({
    id,
    event_id: EVENT.id,
    owner_id: EVENT.owner_id,
    media_key: `${EVENT.owner_id}/${EVENT.id}/${id}.webp`,
    poster_key: null,
    size_bytes: 1000,
    poster_size_bytes: 0,
    media_format: "webp",
    duration_seconds: null,
    processing: "done",
    mime_type: "image/webp",
    kind: "photo",
    width: 2560,
    height: 1707,
    uploader_fingerprint: source === "guest" ? "f".repeat(16) : null,
    source,
    // Postgres defaults this on every insert - see migration 0018.
    review_state: "approved",
    report_count: 0,
    status: "ready",
    created_at: `2026-08-01T00:${String(minute).padStart(2, "0")}:00.000Z`,
  });
}

beforeEach(() => {
  store.reset();
});

describe("the guest gallery", () => {
  it("shows the guests' photographs and not the host's cover", async () => {
    push("guest-a", "guest", 1);
    push("host-cover", "cover", 2);
    push("guest-b", "guest", 3);

    const response = await GET(
      new Request("http://localhost/api/gallery?token=" + "a".repeat(32)),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items.map((item: { id: string }) => item.id)).toEqual([
      "guest-b",
      "guest-a",
    ]);
  });
});
