import { beforeEach, describe, expect, it, vi } from "vitest";

import { COVER_PAGE_SIZE } from "@/lib/media";
import { createStore } from "./stubs/supabase";

/**
 * The page of photographs behind the cover picker.
 *
 * The picker used to show whatever the console had already loaded, cut to two
 * dozen, so a cover shot taken on the second night of a wedding was simply not
 * offered. What matters here is that the cursor is a timestamp rather than an
 * offset - a photo arriving mid-browse must not shuffle a row the host is
 * looking at.
 */

const store = createStore();

const OWNER = "00000000-1111-2222-3333-444444444444";
const EVENT_ID = "11111111-2222-3333-4444-555555555555";

vi.mock("@/lib/host", () => ({
  requireOwnedEvent: vi.fn(async () => ({ id: EVENT_ID, owner_id: OWNER })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => store.client,
}));

vi.mock("@/lib/storage", () => ({
  storage: {
    publicUrl: (key: string) => `https://cdn.example/${key}`,
    presignDownload: vi.fn(async ({ key }: { key: string }) =>
      `https://signed.example/${key}`,
    ),
  },
}));

const { GET } = await import("@/app/api/events/[id]/cover-photos/route");

function get(before?: string) {
  const url = new URL(`http://localhost/api/events/${EVENT_ID}/cover-photos`);
  if (before) url.searchParams.set("before", before);
  return GET(new Request(url), { params: Promise.resolve({ id: EVENT_ID }) });
}

/** A minute apart each, oldest first, so ordering is unambiguous. */
function seed(count: number, source: "guest" | "cover" = "guest") {
  for (let i = 0; i < count; i++) {
    store.rows("media").push({
      id: `${source}-${i}`,
      event_id: EVENT_ID,
      owner_id: OWNER,
      media_key: `${OWNER}/${EVENT_ID}/${source}-${i}.webp`,
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
      created_at: `2026-08-0${1}T00:${String(i).padStart(2, "0")}:00.000Z`,
    });
  }
}

beforeEach(() => {
  store.reset();
});

describe("the cover picker's photo pages", () => {
  it("returns a full page, newest first, with a cursor for the next one", async () => {
    seed(COVER_PAGE_SIZE + 5);
    const body = await (await get()).json();

    expect(body.items).toHaveLength(COVER_PAGE_SIZE);
    expect(body.items[0].id).toBe(`guest-${COVER_PAGE_SIZE + 4}`);
    expect(body.nextCursor).toBe(body.items[COVER_PAGE_SIZE - 1].createdAt);
  });

  it("picks up where the cursor left off, and ends with a null cursor", async () => {
    seed(COVER_PAGE_SIZE + 5);
    const first = await (await get()).json();
    const second = await (await get(first.nextCursor)).json();

    expect(second.items).toHaveLength(5);
    // No overlap: the cursor is exclusive, so nothing is served twice.
    const seen = new Set(first.items.map((item: { id: string }) => item.id));
    expect(second.items.every((item: { id: string }) => !seen.has(item.id)))
      .toBe(true);
    // A short page means there is nothing left, so the picker stops asking.
    expect(second.nextCursor).toBeNull();
  });
});
