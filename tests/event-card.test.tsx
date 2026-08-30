import { ImageResponse } from "next/og";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";
import { OG_SIZE, OgCard } from "@/lib/og-card";
import { HERO, SITE, heroHeadline } from "@/lib/seo";
import { TIERS } from "@/lib/tiers";

/**
 * The card and the title an event's share link unfurls into.
 *
 * Nobody reaches an event page from a search: they are sent the link in a chat
 * and the chat draws a preview. It used to draw the product's - claret,
 * "Let your guests capture the moments you miss" - for a wedding whose guests
 * had already been invited. What matters here is that the event's own picture
 * and name reach the card, that a paid event's card carries none of our
 * branding, and above all that the thing renders: a card that throws at
 * request time is a link that unfurls as a bare URL.
 */

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const store = createStore();

const OWNER = "00000000-1111-2222-3333-444444444444";
const EVENT_ID = "11111111-2222-3333-4444-555555555555";
const COVER_ID = "99999999-8888-7777-6666-555555555555";
const FULL_KEY = `${OWNER}/${EVENT_ID}/full/${COVER_ID}.jpg`;

const EVENT: Record<string, unknown> = {
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
  theme: "ivory",
};

/** What the token resolves to for the next render. Reassigned per test. */
let event: Record<string, unknown> | null = EVENT;

vi.mock("@/lib/guards/guest-token", () => ({
  resolveGuestToken: vi.fn(async () =>
    event ? { event, tokenId: "t" } : null,
  ),
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

const card = await import("@/app/e/[token]/opengraph-image");
const page = await import("@/app/e/[token]/page");

async function bytes(response: Response | ImageResponse): Promise<Buffer> {
  return Buffer.from(await response.arrayBuffer());
}

async function render(): Promise<Buffer> {
  return bytes(await card.default({ params: Promise.resolve({ token: "t" }) }));
}

async function metadata() {
  return page.generateMetadata({ params: Promise.resolve({ token: "t" }) });
}

function pushCover() {
  store.rows("media").push({
    id: COVER_ID,
    event_id: EVENT_ID,
    owner_id: OWNER,
    media_key: FULL_KEY,
    thumb_key: null,
    poster_key: null,
    size_bytes: 2_000_000,
    thumb_size_bytes: 0,
    poster_size_bytes: 0,
    media_format: "jpeg",
    duration_seconds: null,
    processing: "done",
    mime_type: "image/jpeg",
    kind: "photo",
    width: 2560,
    height: 1707,
    uploader_fingerprint: null,
    source: "cover",
    review_state: "approved",
    report_count: 0,
    status: "ready",
    created_at: "2026-08-01T00:00:00.000Z",
  });
}

/**
 * A real photograph for the fetch to return. Drawn rather than checked in: the
 * renderer has to actually decode this, so a handful of magic bytes would pass
 * the sniff and then fail inside the card.
 */
const PHOTO = await bytes(
  new ImageResponse(
    <OgCard kicker="A" headline="Photograph" footnote="B" />,
    OG_SIZE,
  ),
);

function servePhoto(body: Buffer = PHOTO) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(new Uint8Array(body), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        }),
    ),
  );
}

beforeEach(() => {
  store.reset();
  event = { ...EVENT };
  vi.unstubAllGlobals();
});

describe("the card an event link unfurls into", () => {
  it("puts the event's own photograph on it", async () => {
    pushCover();
    servePhoto();

    const withPhoto = await render();

    // Same event, same palette, no cover: whatever else changed, the picture
    // is the difference, and a card that silently dropped it would match.
    store.reset();
    vi.unstubAllGlobals();
    const withoutPhoto = await render();

    expect(withPhoto.subarray(0, 4)).toEqual(PNG_MAGIC);
    expect(withPhoto.equals(withoutPhoto)).toBe(false);
  });

  it("still draws a card when the cover cannot be fetched", async () => {
    pushCover();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("cdn is having a day");
      }),
    );

    // The whole point of fetching the bytes ourselves: this used to be a
    // failure inside the render, which is a broken image rather than a card.
    expect((await render()).subarray(0, 4)).toEqual(PNG_MAGIC);
  });

  it("falls back to the product's card for a link that does not work", async () => {
    event = null;

    const drawn = await render();
    const site = await bytes(
      new ImageResponse(
        <OgCard
          kicker={HERO.kicker}
          headline={heroHeadline()}
          footnote={HERO.subline}
        />,
        OG_SIZE,
      ),
    );

    // A dead token must not put somebody's event name in a stranger's chat.
    expect(drawn.equals(site)).toBe(true);
  });

  it("draws a closed event by name rather than as a dead link", async () => {
    event = { ...EVENT, status: "cancelled" };

    const closed = await render();

    event = null;
    const unknown = await render();

    expect(closed.subarray(0, 4)).toEqual(PNG_MAGIC);
    expect(closed.equals(unknown)).toBe(false);
  });
});

describe("what the preview says", () => {
  it("leads with the event, not with us", async () => {
    const meta = await metadata();

    expect(meta.title).toEqual({ absolute: "Share your photos from Ana and Marko" });
    expect(meta.openGraph?.title).toBe("Share your photos from Ana and Marko");
    expect(meta.description).toContain("Ana and Marko");
    // The date a guest can check against the one in their calendar.
    expect(meta.description).toContain("1 August 2026");
  });

  it("prefers the host's own welcome message", async () => {
    event = { ...EVENT, welcome_message: "  Bring your dancing shoes.  " };

    const meta = await metadata();

    expect(meta.description).toBe("Bring your dancing shoes.");
    expect(meta.openGraph?.description).toBe("Bring your dancing shoes.");
  });

  it("keeps a long welcome message inside what a preview shows", async () => {
    event = { ...EVENT, welcome_message: `${"word ".repeat(80)}end` };

    const meta = await metadata();

    expect(meta.description!.length).toBeLessThanOrEqual(201);
    expect(meta.description!.endsWith("…")).toBe(true);
    // Cut at a word: a description ending mid-word reads as broken.
    expect(meta.description).not.toMatch(/wo…$/);
  });

  it("never lets a share link into the index", async () => {
    const meta = await metadata();

    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("leaves our name off a paid event and keeps it on a free one", async () => {
    // A paid page has no header and no footer of ours; the tab and the chat
    // preview are the two places our name used to survive that.
    const paid = await metadata();
    expect(paid.title).toEqual({ absolute: "Share your photos from Ana and Marko" });
    expect(paid.openGraph?.siteName).toBe("Ana and Marko");

    event = { ...EVENT, tier: TIERS.free.id };
    const free = await metadata();
    expect(free.title).toBe("Share your photos from Ana and Marko");
    expect(free.openGraph?.siteName).toBe(SITE.name);
  });

  it("says nothing about an event a bad token does not name", async () => {
    event = null;

    const meta = await metadata();

    expect(meta.title).toBe("Share photos");
    expect(meta.description).toBeUndefined();
  });
});

describe("reading a cover into a card", () => {
  it("takes a JPEG and a PNG, and nothing it cannot decode", async () => {
    const { sniffImageType } = await import("@/lib/og-photo");

    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg",
    );
    expect(sniffImageType(PHOTO)).toBe("image/png");
    // A WebP thumbnail: the renderer's decoder does not reliably take one,
    // and a card drawn without the photo beats one that fails to draw.
    expect(sniffImageType(Buffer.from("RIFF0000WEBPVP8"))).toBeNull();
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
  });

  it("refuses a file too big to be worth a crawler's few seconds", async () => {
    const { fetchCardPhoto } = await import("@/lib/og-photo");

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array(PHOTO), {
            status: 200,
            headers: { "content-length": "40000000" },
          }),
      ),
    );

    expect(await fetchCardPhoto("https://cdn.example/big.jpg")).toBeNull();
  });

  it("returns nothing for a signature that has expired", async () => {
    const { fetchCardPhoto } = await import("@/lib/og-photo");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 403 })),
    );

    expect(await fetchCardPhoto("https://signed.example/x.jpg")).toBeNull();
    expect(await fetchCardPhoto(null)).toBeNull();
  });

  it("hands over a data URL the card can draw", async () => {
    const { fetchCardPhoto } = await import("@/lib/og-photo");
    servePhoto();

    const data = await fetchCardPhoto("https://cdn.example/cover.jpg");

    // Sniffed, not taken from the header: this response claimed JPEG.
    expect(data?.startsWith("data:image/png;base64,")).toBe(true);
  });
});
