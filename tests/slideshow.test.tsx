import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";
import { Slideshow } from "@/components/dashboard/Slideshow";
import { type MediaView } from "@/types/media";
import { TIERS } from "@/lib/tiers";

const store = createStore();

const OWNER = "00000000-1111-2222-3333-444444444444";
const EVENT = {
  id: "11111111-2222-3333-4444-555555555555",
  owner_id: OWNER,
  name: "Romeo and Juliet",
  tier: TIERS.pro.id,
  status: "active",
};

vi.mock("@/lib/guards/host-action", () => ({
  requireUser: vi.fn(async () => ({
    supabase: store.client,
    user: { id: OWNER },
  })),
}));

vi.mock("@/lib/db/event-repo", () => ({
  findEvent: vi.fn(async () => EVENT),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => store.client,
}));

vi.mock("@/lib/guards/host-api", () => ({
  requireOwnedEvent: vi.fn(async () => EVENT),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => store.client),
}));

vi.mock("@/lib/storage", () => ({
  storage: {
    publicUrl: (key: string) => `https://cdn.example/${key}`,
    presignDownload: vi.fn(
      async ({ key }: { key: string }) => `https://signed.example/${key}`,
    ),
  },
}));

const { default: SlideshowPage } = await import(
  "@/app/dashboard/(projector)/events/[id]/slideshow/page"
);
const { listGuestMediaSince } = await import("@/lib/db/media-repo");
const { GET } = await import("@/app/api/events/[id]/latest/route");

function stored(id: string) {
  return `https://cdn.example/${OWNER}/${EVENT.id}/${id}.jpg`;
}

function push(id: string, reviewState: string, minute: number) {
  store.rows("media").push({
    id,
    event_id: EVENT.id,
    owner_id: OWNER,
    media_key: `${OWNER}/${EVENT.id}/${id}.jpg`,
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
    moderation_labels:
      reviewState === "held" ? [{ name: "Explicit", confidence: 92 }] : null,
    report_count: reviewState === "reported" ? 1 : 0,
    status: "ready",
    // Date.UTC rather than a template, so a test can push past sixty of them.
    created_at: new Date(Date.UTC(2026, 7, 1, 0, minute)).toISOString(),
  });
}

async function wall() {
  return renderToStaticMarkup(
    await SlideshowPage({ params: Promise.resolve({ id: EVENT.id }) }),
  );
}

// next/image puts the source in a query string, so it arrives encoded.
function shows(html: string, url: string) {
  return html.includes(encodeURIComponent(url));
}

function photo(over: Partial<MediaView> & { id: string }): MediaView {
  return {
    kind: "photo",
    width: 2560,
    height: 1707,
    createdAt: "2026-08-01T00:00:00.000Z",
    takenAt: "2026-08-01T00:00:00.000Z",
    uploaderFingerprint: null,
    sizeBytes: 1000,
    previewUrl: null,
    fullUrl: null,
    posterUrl: null,
    durationSeconds: null,
    processing: false,
    format: "jpeg",
    ...over,
  };
}

function show(initial: MediaView[], olderThan: string | null = null) {
  return renderToStaticMarkup(
    <Slideshow
      eventId={EVENT.id}
      eventName={EVENT.name}
      backHref={`/dashboard/events/${EVENT.id}`}
      initial={initial}
      olderThan={olderThan}
    />,
  );
}

beforeEach(() => {
  store.reset();
});

describe("what reaches the projector", () => {
  it("leaves out anything the host has not approved", async () => {
    push("approved-a", "approved", 1);
    push("held-b", "held", 2);
    push("reported-c", "reported", 3);

    const html = await wall();

    expect(shows(html, stored("approved-a"))).toBe(true);
    expect(shows(html, stored("held-b"))).toBe(false);
    expect(shows(html, stored("reported-c"))).toBe(false);
  });

  it("keeps them out of the poll that runs all night, too", async () => {
    push("approved-a", "approved", 1);
    push("held-b", "held", 2);
    push("approved-c", "approved", 3);

    const rows = await listGuestMediaSince(
      store.client as never,
      EVENT.id,
      "2026-08-01T00:01:30.000Z",
      60,
    );

    expect(rows.map((row) => row.id)).toEqual(["approved-c"]);
  });
});

describe("each slide", () => {
  it("is the full copy, not the thumbnail cut for grid tiles", () => {
    const html = show([
      photo({
        id: "a",
        previewUrl: "https://cdn.example/thumb/a.webp",
        fullUrl: "https://cdn.example/full/a.jpg",
      }),
    ]);

    expect(shows(html, "https://cdn.example/full/a.jpg")).toBe(true);
    expect(shows(html, "https://cdn.example/thumb/a.webp")).toBe(false);
  });

  it("is nothing at all rather than a thumbnail standing in for one", () => {
    const html = show([
      photo({ id: "ready", fullUrl: "https://cdn.example/full/ready.jpg" }),
      photo({ id: "heic", previewUrl: "https://cdn.example/thumb/heic.webp" }),
    ]);

    expect(shows(html, "https://cdn.example/thumb/heic.webp")).toBe(false);
    expect(html).toContain("1 / 1");
  });
});

describe("the rest of the evening", () => {
  it("opens on the first photograph, not part-way through", () => {
    const html = show([
      photo({ id: "a", fullUrl: "https://cdn.example/full/a.jpg" }),
      photo({ id: "b", fullUrl: "https://cdn.example/full/b.jpg" }),
      photo({ id: "c", fullUrl: "https://cdn.example/full/c.jpg" }),
    ]);

    expect(html).toContain("1 / 3");
  });

  it("hands the wall a cursor when the seed does not cover the event", async () => {
    for (let i = 0; i <= 60; i++) push(`p-${i}`, "approved", i);

    const element = await SlideshowPage({
      params: Promise.resolve({ id: EVENT.id }),
    });

    expect(element.props.olderThan).toBe("2026-08-01T00:01:00.000Z");
  });

  it("pages backwards through approved photographs only", async () => {
    push("a", "approved", 1);
    push("held-b", "held", 2);
    push("c", "approved", 3);

    const res = await GET(
      new Request(
        `http://localhost/api/events/${EVENT.id}/latest?before=2026-08-01T00:03:30.000Z`,
      ),
      { params: Promise.resolve({ id: EVENT.id }) },
    );
    const body = (await res.json()) as {
      items: Array<{ id: string }>;
      nextCursor: string | null;
    };

    expect(body.items.map((item) => item.id)).toEqual(["c", "a"]);
    expect(body.nextCursor).toBeNull();
  });
});

describe("the route", () => {
  const app = path.join(process.cwd(), "src/app");
  const slideshow = path.join(
    app,
    "dashboard/(projector)/events/[id]/slideshow",
  );

  it("inherits no layout that draws a header", () => {
    expect(existsSync(path.join(slideshow, "page.tsx"))).toBe(true);

    const layouts: string[] = [];
    for (let dir = slideshow; dir.startsWith(app); dir = path.dirname(dir)) {
      const file = path.join(dir, "layout.tsx");
      if (existsSync(file)) layouts.push(readFileSync(file, "utf8"));
    }

    expect(layouts.length).toBeGreaterThan(0);
    for (const source of layouts) expect(source).not.toContain("HeaderShell");
  });
});
