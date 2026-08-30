import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";
import { TIERS } from "@/lib/tiers";

/**
 * Presign, upload, confirm - the three calls a guest's photo actually makes,
 * run against each other rather than against a mock of each other.
 *
 * Every other upload test stubs the storage driver, so the one thing none of
 * them can see is whether the presigned upload the route hands out is one the
 * bucket will accept. That is exactly where a guest's upload fails: the route
 * answers 200, the browser posts the bytes, and storage rejects them.
 */

const store = createStore();

const EVENT = {
  id: "11111111-2222-3333-4444-555555555555",
  owner_id: "00000000-1111-2222-3333-444444444444",
  tier: TIERS.pro.id,
  status: "active",
  storage_quota_bytes: 2 * 1024 ** 3,
  storage_used_bytes: 0,
};

vi.mock("@/lib/events", async () => {
  const actual = await vi.importActual<typeof import("@/lib/events")>(
    "@/lib/events",
  );
  return {
    ...actual,
    requireGuestEvent: vi.fn(async () => ({ event: EVENT, tokenId: "t" })),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => store.client,
}));

const { POST: presign } = await import("@/app/api/upload/presign/route");
const { POST: confirm } = await import("@/app/api/upload/confirm/route");
const { POST: putObject } = await import("@/app/api/storage/local/route");

let requests = 0;
const token = () => `${(requests += 1)}`.padStart(32, "a");

const FINGERPRINT = "f".repeat(16);

async function presignFor(file: unknown) {
  const response = await presign(
    new Request("http://localhost/api/upload/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: token(),
        fingerprint: FINGERPRINT,
        file,
      }),
    }),
  );
  return { status: response.status, body: await response.json() };
}

/** The FormData the browser builds in uploadToPresigned, posted for real. */
async function sendBytes(
  presigned: { url: string; fields: Record<string, string>; fileField: string },
  body: Blob,
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(presigned.fields)) {
    form.append(key, value);
  }
  form.append(presigned.fileField, body);

  const response = await putObject(
    new Request(presigned.url, { method: "POST", body: form }),
  );
  return {
    status: response.status,
    text: response.status === 204 ? "" : await response.text(),
  };
}

beforeEach(() => {
  store.reset();
  requests = 0;
});

describe("a photo whose type the picker never reported", () => {
  it("is signed and stored as what the browser produced", async () => {
    const compressed = new Blob([new Uint8Array(80_000)], {
      type: "image/webp",
    });

    const { status, body } = await presignFor({
      size: 3_000_000,
      type: "",
      compressed: { size: compressed.size, format: "webp" },
      sourceWidth: 4032,
      sourceHeight: 3024,
      needsServer: false,
    });

    expect(status).toBe(200);
    expect(body.upload.media.fields["Content-Type"]).toBe("image/webp");

    const sent = await sendBytes(body.upload.media, compressed);
    expect(sent.text).toBe("");
    expect(sent.status).toBe(204);
  });
});

describe("a photo the browser could not decode", () => {
  it("goes up as it came off the phone", async () => {
    const original = new Blob([new Uint8Array(400_000)], {
      type: "image/heic",
    });

    const { status, body } = await presignFor({
      size: original.size,
      type: "image/heic",
      compressed: null,
      sourceWidth: null,
      sourceHeight: null,
      needsServer: true,
    });

    expect(status).toBe(200);
    expect(body.upload.source).toBe("file");

    const sent = await sendBytes(body.upload.media, original);
    expect(sent.text).toBe("");
    expect(sent.status).toBe(204);
  });
});

describe("the whole handshake", () => {
  /** Presign, post the bytes, confirm. Returns the confirm response body. */
  async function handshake(opts: { sendThumb: boolean }) {
    const full = new Blob([new Uint8Array(90_000)], { type: "image/jpeg" });
    const thumb = new Blob([new Uint8Array(9_000)], { type: "image/webp" });

    const { body } = await presignFor({
      size: 2_000_000,
      type: "image/jpeg",
      compressed: { size: full.size, format: "jpeg" },
      thumb: { size: thumb.size, format: "webp" },
      sourceWidth: 4032,
      sourceHeight: 3024,
      needsServer: false,
    });

    expect((await sendBytes(body.upload.media, full)).status).toBe(204);
    if (opts.sendThumb) {
      expect((await sendBytes(body.upload.thumb, thumb)).status).toBe(204);
    }

    const response = await confirm(
      new Request("http://localhost/api/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token(),
          fingerprint: FINGERPRINT,
          mediaId: body.upload.mediaId,
          width: 4032,
          height: 3024,
          mediaUploaded: true,
          thumbUploaded: opts.sendThumb,
          posterUploaded: false,
          failed: false,
        }),
      }),
    );

    return await response.json();
  }

  it("ends with a media row the gallery can read", async () => {
    expect(await handshake({ sendThumb: true })).toEqual({ confirmed: true, held: false });

    const rows = store.rows("media");
    expect(rows).toHaveLength(1);
    expect(rows[0].thumb_key).toMatch(/\/thumb\/[^/]+\.webp$/);
    expect(rows[0].media_key).toMatch(/\/full\/[^/]+\.jpg$/);
  });
});
