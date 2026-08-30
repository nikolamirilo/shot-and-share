import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";
import { Slideshow } from "@/components/dashboard/slideshow";
import type { MediaView } from "@/lib/media-view";
import { TIERS } from "@/lib/tiers";

/**
 * The wall at the venue.
 *
 * Everything here is about the one screen in the product nobody can look away
 * from: it is a projector pointed at a room full of people, so a mistake on it
 * is a mistake in public and stays there for seven seconds at a time.
 *
 * Two of them had been made. The seed query read the host's console view of
 * the media table rather than the guest's, so a photograph held for review was
 * on the wall on the first frame - the exact failure held-media-visibility.test
 * warns about and did not cover. Each slide was drawn from `previewUrl`, a
 * 640px thumbnail cut for grid tiles, blown up across 1080p.
 */

const store = createStore();

const OWNER = "00000000-1111-2222-3333-444444444444";
const EVENT = {
  id: "11111111-2222-3333-4444-555555555555",
  owner_id: OWNER,
  name: "Ana and Marko",
  tier: TIERS.pro.id,
  status: "active",
};

vi.mock("@/lib/actions/guards", () => ({
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

vi.mock("@/lib/host", () => ({
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

/** The URL the page will resolve a stored object to, given the mock above. */
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

/** next/image puts the source in a query string, so it arrives encoded. */
function shows(html: string, url: string) {
  return html.includes(encodeURIComponent(url));
}

function photo(over: Partial<MediaView> & { id: string }): MediaView {
  return {
    kind: "photo",
    width: 2560,
    height: 1707,
    createdAt: "2026-08-01T00:00:00.000Z",
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

    // The cursor sits just past the first photograph, which is where it would
    // be an instant after the wall drew it.
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
  /*
   * THUMB_MAX_EDGE is 640. A wedding photograph at 640px across a projector is
   * the one thing on this screen everybody in the room can see is wrong.
   */
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

  /*
   * The fallback that made a wall of sharp photographs go soft every fourth
   * slide: `previewUrl` resolves to the thumbnail whenever the full copy is
   * missing, so anything not yet converted was quietly served at 640px.
   */
  it("is nothing at all rather than a thumbnail standing in for one", () => {
    const html = show([
      photo({ id: "ready", fullUrl: "https://cdn.example/full/ready.jpg" }),
      photo({ id: "heic", previewUrl: "https://cdn.example/thumb/heic.webp" }),
    ]);

    expect(shows(html, "https://cdn.example/thumb/heic.webp")).toBe(false);
    expect(html).toContain("1 / 1");
  });
});

/**
 * The seed is a page, not the event, and the browser fetches the rest. Both
 * halves of that had to be got right: a wall holding only the newest sixty is a
 * slideshow of the last ten minutes, and one that keeps the seed under the
 * viewer's eye while the earlier photographs land in front of it opens the
 * evening on photograph 223 of 282.
 */
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
    // One more than the seed, so there is an earlier page to go and get.
    for (let i = 0; i <= 60; i++) push(`p-${i}`, "approved", i);

    const element = await SlideshowPage({
      params: Promise.resolve({ id: EVENT.id }),
    });

    // The oldest of the sixty seeded, which is where the browser picks up.
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

    // Newest first off the wire; the wall turns each page round itself.
    expect(body.items.map((item) => item.id)).toEqual(["c", "a"]);
    // A short page is the end of the event, so there is nowhere further back.
    expect(body.nextCursor).toBeNull();
  });
});

describe("the route", () => {
  const app = path.join(process.cwd(), "src/app");
  const slideshow = path.join(
    app,
    "dashboard/(projector)/events/[id]/slideshow",
  );

  /**
   * The reason the slideshow sits outside `(shell)`: laid out with the rest of
   * the dashboard it inherited the navigation card, which is `z-10` over a page
   * that is `fixed inset-0` - a header, a wordmark and a sign-out badge across
   * the top of somebody's wedding.
   */
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
