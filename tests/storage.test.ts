import { rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, describe, expect, it } from "vitest";

import { localDriver, safeKey, signLocal, verifyLocal } from "@/lib/storage/local";
import {
  archiveKey,
  eventPrefix,
  originalKey,
  ownerPrefix,
  thumbKey,
} from "@/lib/media";

const OWNER = "test-owner-0001";
const EVENT = "test-event-0001";
const SCOPE = { ownerId: OWNER, eventId: EVENT };

afterAll(async () => {
  await rm(path.join(process.cwd(), ".storage", "u", OWNER), {
    recursive: true,
    force: true,
  });
});

describe("local storage driver", () => {
  it("round-trips an object", async () => {
    const key = originalKey(SCOPE, "media-1", "jpg");
    await localDriver.put({
      key,
      body: Buffer.from("hello photo"),
      contentType: "image/jpeg",
    });

    expect(await localDriver.head(key)).toEqual({ size: 11 });

    const chunks: Buffer[] = [];
    for await (const chunk of await localDriver.getStream(key)) {
      chunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(chunks).toString()).toBe("hello photo");
  });

  it("accepts a stream body, which is how the ZIP is written", async () => {
    const key = archiveKey(SCOPE);
    await localDriver.put({
      key,
      body: Readable.from([Buffer.from("PK"), Buffer.from("zip")]),
      contentType: "application/zip",
    });
    expect((await localDriver.head(key))?.size).toBe(5);
  });

  it("reports a missing object as null rather than throwing", async () => {
    expect(await localDriver.head("u/nope/nope/originals/nope.jpg")).toBeNull();
  });

  it("removes a whole event prefix", async () => {
    await localDriver.put({
      key: thumbKey(SCOPE, "media-1"),
      body: Buffer.from("thumb"),
      contentType: "image/webp",
    });

    const removed = await localDriver.removePrefix(eventPrefix(SCOPE));
    expect(removed).toBeGreaterThanOrEqual(2);
    expect(await localDriver.head(originalKey(SCOPE, "media-1", "jpg"))).toBeNull();
  });

  it("removes a whole owner prefix, which is how an account is closed", async () => {
    const other = { ownerId: OWNER, eventId: "test-event-0002" };
    await localDriver.put({
      key: originalKey(other, "media-9", "jpg"),
      body: Buffer.from("another event, same host"),
      contentType: "image/jpeg",
    });

    const removed = await localDriver.removePrefix(ownerPrefix(OWNER));
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await localDriver.head(originalKey(other, "media-9", "jpg"))).toBeNull();
  });

  it("returns 0 for a prefix that does not exist", async () => {
    expect(
      await localDriver.removePrefix(
        eventPrefix({ ownerId: OWNER, eventId: "never-existed" }),
      ),
    ).toBe(0);
  });
});

describe("local presigning", () => {
  it("signs an upload with a size limit and an expiry", async () => {
    const presigned = await localDriver.presignUpload({
      key: originalKey(SCOPE, "media-2", "jpg"),
      contentType: "image/jpeg",
      maxBytes: 1234,
    });

    expect(presigned.fileField).toBe("file");
    expect(presigned.fields.max).toBe("1234");
    expect(Number(presigned.fields.exp)).toBeGreaterThan(Date.now() / 1000);

    // The endpoint recomputes exactly this.
    expect(
      verifyLocal(
        [
          "put",
          presigned.fields.key,
          presigned.fields.exp,
          presigned.fields.max,
          presigned.fields["Content-Type"],
        ],
        presigned.fields.sig,
      ),
    ).toBe(true);
  });

  it("refuses a signature for a different key, size or type", async () => {
    const mine = "u/owner-a/event-a/originals/1.jpg";
    const sig = signLocal(["put", mine, "999", "100", "image/jpeg"]);

    // Swapping the event would let anyone overwrite another event's object.
    expect(verifyLocal(["put", "u/owner-a/event-b/originals/1.jpg", "999", "100", "image/jpeg"], sig)).toBe(false);
    // Swapping the owner is the cross-tenant case, and matters more.
    expect(verifyLocal(["put", "u/owner-b/event-a/originals/1.jpg", "999", "100", "image/jpeg"], sig)).toBe(false);
    // Raising the limit is the whole reason the size is in the signature.
    expect(verifyLocal(["put", mine, "999", "999999999", "image/jpeg"], sig)).toBe(false);
    expect(verifyLocal(["put", mine, "999", "100", "text/html"], sig)).toBe(false);
    expect(verifyLocal(["put", mine, "999", "100", "image/jpeg"], "")).toBe(false);
  });

  it("signs downloads separately from uploads", async () => {
    const url = await localDriver.presignDownload({
      key: originalKey(SCOPE, "media-2", "jpg"),
      downloadName: "photo.jpg",
    });
    const params = new URL(url).searchParams;

    expect(
      verifyLocal(
        ["get", params.get("key")!, params.get("exp")!, params.get("name")!],
        params.get("sig")!,
      ),
    ).toBe(true);

    // A read signature must not be usable as a write signature.
    expect(
      verifyLocal(
        ["put", params.get("key")!, params.get("exp")!, params.get("name")!],
        params.get("sig")!,
      ),
    ).toBe(false);
  });
});

describe("key safety", () => {
  it("rejects traversal, however it is spelled", () => {
    expect(() => safeKey("../../../etc/passwd")).toThrow();
    expect(() => safeKey("/etc/passwd")).toThrow();
    expect(() => safeKey("u/a/b/../../../../secrets")).toThrow();
  });

  it("normalises within the root rather than enforcing the owner prefix", () => {
    // Worth being precise about what this function is: it stops a key escaping
    // the storage root, not a key escaping its own tenant folder. One `..` per
    // segment lands back at the root, and that is allowed.
    expect(safeKey("u/a/b/../../../secrets")).toBe("secrets");
    // The tenant boundary is held elsewhere - keys are built server-side from
    // the owner on the row, the CHECK constraint in 0007 refuses anything else,
    // and both local endpoints match the full key before touching disk.
  });

  it("allows the keys the application actually generates", () => {
    expect(safeKey(originalKey(SCOPE, "m", "jpg"))).toBe(
      `u/${OWNER}/${EVENT}/originals/m.jpg`,
    );
    expect(safeKey(thumbKey(SCOPE, "m"))).toBe(
      `u/${OWNER}/${EVENT}/thumbs/m.webp`,
    );
  });
});
