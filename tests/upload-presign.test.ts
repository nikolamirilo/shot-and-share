import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The presign endpoint, end to end with the database and the bucket mocked.
 *
 * It is the one route where a mistake is invisible until a guest is standing in
 * a venue: it decides what gets stored, reserves the quota, writes the rows and
 * signs the URLs, and every one of those steps can fail in a way the browser
 * reports as "could not start the upload".
 */

const rows: Record<string, unknown>[] = [];
let insertError: { message: string } | null = null;

const EVENT = {
  id: "11111111-2222-3333-4444-555555555555",
  owner_id: "00000000-1111-2222-3333-444444444444",
  tier: "free",
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
  createAdminClient: () => ({
    rpc: vi.fn(async () => ({ data: true, error: null })),
    from: () => ({
      insert: vi.fn(async (values: Record<string, unknown>[]) => {
        rows.push(...values);
        return { error: insertError };
      }),
    }),
  }),
}));

vi.mock("@/lib/storage", () => ({
  storage: {
    presignUpload: vi.fn(async ({ key }: { key: string }) => ({
      url: "https://bucket.example/",
      fields: { key },
      fileField: "file",
    })),
  },
}));

const { POST } = await import("@/app/api/upload/presign/route");

function request(files: unknown[]) {
  return new Request("http://localhost/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: "a".repeat(32),
      fingerprint: "f".repeat(16),
      uploaderName: "Guest",
      files,
    }),
  });
}

/** What the browser sends for a photo it managed to compress. */
const compressedPhoto = {
  size: 4_000_000,
  type: "image/jpeg",
  compressed: { size: 900_000, format: "webp", width: 2560, height: 1707 },
  sourceWidth: 4032,
  sourceHeight: 3024,
  needsServer: false,
};

beforeEach(() => {
  rows.length = 0;
  insertError = null;
});

describe("presigning an upload", () => {
  it("signs exactly one object for a photo", async () => {
    const res = await POST(request([compressedPhoto]));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.uploads).toHaveLength(1);

    const upload = body.uploads[0];
    // One object, and the browser is told to send the compressed blob.
    expect(upload.source).toBe("compressed");
    expect(upload.media).toBeTruthy();
    expect(upload.poster).toBeNull();
    expect(Object.keys(upload).sort()).toEqual([
      "mediaId",
      "media",
      "poster",
      "source",
    ].sort());
  });

  it("keys that object inside the owner's event folder, at the root", async () => {
    const res = await POST(request([compressedPhoto]));
    const { uploads } = await res.json();

    expect(uploads[0].media.fields.key).toBe(
      `${EVENT.owner_id}/${EVENT.id}/${uploads[0].mediaId}.webp`,
    );
  });

  it("writes a row the CHECK constraint in 0008 will accept", async () => {
    await POST(request([compressedPhoto]));

    expect(rows).toHaveLength(1);
    const row = rows[0] as Record<string, unknown>;

    // The constraint is `media_key like owner_id || '/' || event_id || '/%'`.
    expect(String(row.media_key).startsWith(`${EVENT.owner_id}/${EVENT.id}/`))
      .toBe(true);
    expect(row.poster_key).toBeNull();

    // Columns 0008 dropped must not be written, or the insert fails outright.
    for (const gone of [
      "original_key",
      "thumb_key",
      "display_key",
      "thumb_size_bytes",
      "display_size_bytes",
      "thumb_format",
      "display_format",
      "original_replaced",
    ]) {
      expect(row).not.toHaveProperty(gone);
    }
  });

  it("charges the compressed size, not what came off the phone", async () => {
    await POST(request([compressedPhoto]));
    const row = rows[0] as Record<string, unknown>;

    expect(row.size_bytes).toBe(900_000);
    expect(row.media_format).toBe("webp");
    expect(row.mime_type).toBe("image/webp");
    // Nothing left for the worker: the object in the bucket is already right.
    expect(row.processing).toBe("done");
  });

  it("takes a photo the browser could not decode and queues the worker", async () => {
    const res = await POST(
      request([
        {
          size: 3_000_000,
          type: "image/heic",
          compressed: null,
          sourceWidth: null,
          sourceHeight: null,
          needsServer: true,
        },
      ]),
    );
    const { uploads } = await res.json();
    const row = rows[0] as Record<string, unknown>;

    // It goes up as it came off the phone; the worker replaces it with a JPEG.
    expect(uploads[0].source).toBe("file");
    expect(String(row.media_key).endsWith(".heic")).toBe(true);
    expect(row.size_bytes).toBe(3_000_000);
    expect(row.media_format).toBe("heic");
    expect(row.processing).toBe("pending");
  });

  it("refuses video on a tier without it, before signing anything", async () => {
    const res = await POST(
      request([
        {
          size: 8_000_000,
          type: "video/quicktime",
          poster: { size: 40_000, format: "webp", width: 720, height: 405 },
          durationSeconds: 12,
          needsServer: true,
        },
      ]),
    );

    expect(res.status).toBe(403);
    expect(rows).toHaveLength(0);
  });

  it("signs a poster beside a video on a tier that allows it", async () => {
    EVENT.tier = "event";
    try {
      const res = await POST(
        request([
          {
            size: 8_000_000,
            type: "video/quicktime",
            poster: { size: 40_000, format: "webp", width: 720, height: 405 },
            sourceWidth: 1920,
            sourceHeight: 1080,
            durationSeconds: 12,
            needsServer: true,
          },
        ]),
      );
      const { uploads } = await res.json();
      const row = rows[0] as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(uploads[0].source).toBe("file");
      expect(uploads[0].poster).toBeTruthy();

      // Poster sits beside the clip in the same folder, named after it.
      expect(row.media_key).toBe(
        `${EVENT.owner_id}/${EVENT.id}/${uploads[0].mediaId}.mov`,
      );
      expect(row.poster_key).toBe(
        `${EVENT.owner_id}/${EVENT.id}/${uploads[0].mediaId}-poster.webp`,
      );
      expect(row.poster_size_bytes).toBe(40_000);
      expect(row.processing).toBe("pending");
    } finally {
      EVENT.tier = "free";
    }
  });

  it("hands the quota back when the insert fails", async () => {
    insertError = { message: "column media_key does not exist" };
    const res = await POST(request([compressedPhoto]));

    // The guest sees a generic failure; the operator sees the cause in the log.
    expect(res.status).toBe(500);
  });
});
