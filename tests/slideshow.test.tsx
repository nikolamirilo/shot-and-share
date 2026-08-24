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
 * Three of them had been made. The seed query read the host's console view of
 * the media table rather than the guest's, so a photograph held for review was
 * on the wall on the first frame - the exact failure held-media-visibility.test
 * warns about and did not cover. Each slide was drawn from `previewUrl`, a
 * 640px thumbnail cut for grid tiles, blown up across 1080p. And a photograph
 * still being converted, which has no URL at all, took its turn as seven
 * seconds of black.
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
    created_at: `2026-08-01T00:${String(minute).padStart(2, "0")}:00.000Z`,
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

function show(initial: MediaView[]) {
  return renderToStaticMarkup(
    <Slideshow
      eventId={EVENT.id}
      eventName={EVENT.name}
      backHref={`/dashboard/events/${EVENT.id}`}
      initial={initial}
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

  it("shows nothing at all when everything is waiting on the host", async () => {
    push("held-a", "held", 1);
    push("held-b", "held", 2);

    expect(await wall()).toContain("Waiting for the first photo");
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

  /** A clip has no full copy. Its poster frame is the slide. */
  it("falls back to the poster frame for a clip", () => {
    const html = show([
      photo({
        id: "clip",
        kind: "video",
        previewUrl: "https://cdn.example/poster/clip.webp",
        posterUrl: "https://cdn.example/poster/clip.webp",
      }),
    ]);

    expect(shows(html, "https://cdn.example/poster/clip.webp")).toBe(true);
  });

  it("is never a photograph that has nothing to draw yet", () => {
    const html = show([
      photo({ id: "ready", fullUrl: "https://cdn.example/full/ready.jpg" }),
      // Still with the worker: in the bucket, but a broken image everywhere.
      photo({ id: "converting", processing: true }),
    ]);

    expect((html.match(/<img/g) ?? []).length).toBe(1);
    // And it is not counted either, or the wall claims a photo it cannot show.
    expect(html).toContain("1 / 1");
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

  it("has not taken the header away from the rest of the console", () => {
    const shell = readFileSync(
      path.join(app, "dashboard/(shell)/layout.tsx"),
      "utf8",
    );
    expect(shell).toContain("HeaderShell");
  });
});
