import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";
import { TIERS } from "@/lib/tiers";

/**
 * A held photograph must not reach a guest.
 *
 * The same shape of quiet failure as the cover column next door: everything
 * held, flagged or reported sits in `media` alongside everything approved, one
 * column apart. Forget the column in one query and the whole point of screening
 * uploads is gone, silently, on the one evening it mattered.
 *
 * Worth being blunt about which query: the gallery is the obvious one, and the
 * slideshow is the one that hurts, because it is projected on a wall in front
 * of everybody.
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

vi.mock("@/lib/guards/guest-token", () => ({
  resolveGuestToken: vi.fn(async () => ({ event: EVENT, tokenId: "t" })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => store.client,
}));

vi.mock("@/lib/storage", () => ({
  storage: {
    publicUrl: (key: string) => `https://cdn.example/${key}`,
    presignDownload: vi.fn(
      async ({ key }: { key: string }) => `https://signed.example/${key}`,
    ),
  },
}));

const { GET } = await import("@/app/api/gallery/route");
const { listGuestMediaOldestFirst, listMediaAwaitingReview } = await import(
  "@/lib/db/media-repo"
);

const TOKEN = "t".repeat(32);

function push(id: string, reviewState: string, minute: number) {
  store.rows("media").push({
    id,
    event_id: EVENT.id,
    owner_id: EVENT.owner_id,
    media_key: `${EVENT.owner_id}/${EVENT.id}/${id}.jpg`,
    thumb_key: null,
    poster_key: null,
    size_bytes: 1000,
    thumb_size_bytes: 0,
    poster_size_bytes: 0,
    media_format: "jpeg",
    duration_seconds: null,
    processing: "done",
    mime_type: "image/jpeg",
    kind: "photo",
    width: 2560,
    height: 1707,
    uploader_fingerprint: "f".repeat(16),
    source: "guest",
    review_state: reviewState,
    moderation_labels: reviewState === "held" ? [{ name: "Explicit", confidence: 92 }] : null,
    report_count: reviewState === "reported" ? 1 : 0,
    status: "ready",
    created_at: `2026-08-01T00:${String(minute).padStart(2, "0")}:00.000Z`,
  });
}

async function gallery() {
  const res = await GET(
    new Request(`http://localhost/api/gallery?token=${TOKEN}`),
  );
  return (await res.json()) as { items: Array<{ id: string }> };
}

beforeEach(() => {
  store.reset();
});

describe("the guest gallery", () => {
  it("shows approved photographs and nothing else", async () => {
    push("approved-a", "approved", 1);
    push("held-b", "held", 2);
    push("reported-c", "reported", 3);

    const body = await gallery();

    expect(body.items.map((item) => item.id)).toEqual(["approved-a"]);
  });
});

describe("the ZIP", () => {
  /*
   * A held photograph in the download would quietly undo the holding: the host
   * gets it either way, but the point is that they look at it first.
   */
  it("leaves out anything the host has not approved", async () => {
    push("approved-a", "approved", 1);
    push("held-b", "held", 2);

    const rows = await listGuestMediaOldestFirst(
      store.client as never,
      EVENT.id,
    );

    expect(rows.map((row) => row.id)).toEqual(["approved-a"]);
  });
});

describe("the host's review queue", () => {
  it("holds exactly what the gallery is missing, oldest first", async () => {
    push("approved-a", "approved", 1);
    push("held-b", "held", 2);
    push("reported-c", "reported", 3);

    const rows = await listMediaAwaitingReview(store.client as never, EVENT.id);

    expect(rows.map((row) => row.id)).toEqual(["held-b", "reported-c"]);
  });
});
