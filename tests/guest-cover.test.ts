import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";
import { TIERS } from "@/lib/tiers";

/**
 * Which stored copy the guest page's cover loads.
 *
 * The cover is one photograph across a whole phone, and the gallery grid is
 * fifty of them at 96px. They want opposite files, and the page used to ask for
 * the grid's: the 640px thumbnail, stretched to full screen and visibly soft.
 */

const store = createStore();

const OWNER = "00000000-1111-2222-3333-444444444444";
const EVENT_ID = "11111111-2222-3333-4444-555555555555";
const COVER_ID = "99999999-8888-7777-6666-555555555555";

const EVENT = {
  id: EVENT_ID,
  owner_id: OWNER,
  name: "Ana and Marko",
  event_date: "2026-08-01",
  welcome_message: null,
  tier: TIERS.plus.id,
  status: "active",
  expires_at: null,
  gallery_visible: true,
  storage_used_bytes: 0,
  storage_quota_bytes: 1000,
  cover_media_id: COVER_ID,
  cover_variant: "full",
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

const { loadGuestPage } = await import("@/lib/views/guest-page");

const FULL_KEY = `${OWNER}/${EVENT_ID}/full/${COVER_ID}.webp`;
const THUMB_KEY = `${OWNER}/${EVENT_ID}/thumb/${COVER_ID}.webp`;

function pushCover(over: Record<string, unknown> = {}) {
  store.rows("media").push({
    id: COVER_ID,
    event_id: EVENT_ID,
    owner_id: OWNER,
    media_key: FULL_KEY,
    thumb_key: THUMB_KEY,
    poster_key: null,
    size_bytes: 2_000_000,
    thumb_size_bytes: 25_000,
    poster_size_bytes: 0,
    media_format: "webp",
    duration_seconds: null,
    processing: "done",
    mime_type: "image/webp",
    kind: "photo",
    width: 2560,
    height: 1707,
    uploader_fingerprint: null,
    source: "cover",
    status: "ready",
    created_at: "2026-08-01T00:00:00.000Z",
    ...over,
  });
}

async function open() {
  const page = await loadGuestPage("token");
  if (page.state !== "open") throw new Error(`expected open, got ${page.state}`);
  return page;
}

beforeEach(() => {
  store.reset();
});

describe("the guest page cover", () => {
  it("loads the full copy, not the grid's thumbnail", async () => {
    pushCover();

    const page = await open();

    expect(page.coverUrl).toBe(`https://cdn.example/${FULL_KEY}`);
    expect(page.fullScreenCover).toBe(true);
  });

  // A HEIC the browser cannot open has no full copy to serve until the worker
  // has replaced it. A soft cover beats an empty one.
  it("falls back to the thumbnail when there is no viewable full copy", async () => {
    pushCover({ media_format: "heic", media_key: FULL_KEY.replace(".webp", ".heic") });

    const page = await open();

    expect(page.coverUrl).toBe(`https://cdn.example/${THUMB_KEY}`);
  });

  it("has no cover at all when the row has neither copy", async () => {
    pushCover({ media_format: "heic", thumb_key: null });

    const page = await open();

    expect(page.coverUrl).toBeNull();
    expect(page.fullScreenCover).toBe(false);
  });
});
