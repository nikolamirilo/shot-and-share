import { rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, describe, expect, it } from "vitest";

import { localDriver, safeKey, signLocal, verifyLocal } from "@/lib/storage/local";
import {
  archiveKey,
  eventPrefix,
  mediaKey,
  thumbKey,
  posterKey,
} from "@/lib/media";

const OWNER = "test-owner-0001";
const EVENT = "test-event-0001";
const SCOPE = { ownerId: OWNER, eventId: EVENT };

afterAll(async () => {
  await rm(path.join(process.cwd(), ".storage", OWNER), {
    recursive: true,
    force: true,
  });
});

describe("local storage driver", () => {
  it("accepts a stream body, which is how the ZIP is written", async () => {
    const key = archiveKey(SCOPE);
    await localDriver.put({
      key,
      body: Readable.from([Buffer.from("PK"), Buffer.from("zip")]),
      contentType: "application/zip",
    });
    expect((await localDriver.head(key))?.size).toBe(5);
  });

  it("removes a whole event prefix", async () => {
    await localDriver.put({
      key: posterKey(SCOPE, "media-1"),
      body: Buffer.from("poster"),
      contentType: "image/webp",
    });

    const removed = await localDriver.removePrefix(eventPrefix(SCOPE));
    expect(removed).toBeGreaterThanOrEqual(2);
    expect(await localDriver.head(mediaKey(SCOPE, "media-1", "jpg"))).toBeNull();
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
      key: mediaKey(SCOPE, "media-2", "jpg"),
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
    const mine = "owner-a/event-a/1.jpg";
    const sig = signLocal(["put", mine, "999", "100", "image/jpeg"]);

    // Swapping the event would let anyone overwrite another event's object.
    expect(verifyLocal(["put", "owner-a/event-b/1.jpg", "999", "100", "image/jpeg"], sig)).toBe(false);
    // Swapping the owner is the cross-tenant case, and matters more.
    expect(verifyLocal(["put", "owner-b/event-a/1.jpg", "999", "100", "image/jpeg"], sig)).toBe(false);
    // Raising the limit is the whole reason the size is in the signature.
    expect(verifyLocal(["put", mine, "999", "999999999", "image/jpeg"], sig)).toBe(false);
    expect(verifyLocal(["put", mine, "999", "100", "text/html"], sig)).toBe(false);
    expect(verifyLocal(["put", mine, "999", "100", "image/jpeg"], "")).toBe(false);
  });

  it("signs downloads separately from uploads", async () => {
    const url = await localDriver.presignDownload({
      key: mediaKey(SCOPE, "media-2", "jpg"),
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
    expect(() => safeKey("a/b/../../../secrets")).toThrow();
  });

  it("allows the keys the application actually generates", () => {
    // Folders included: a key with one legitimate slash in it must survive the
    // traversal check, or every photo since migration 0015 is unreadable.
    expect(safeKey(mediaKey(SCOPE, "m", "jpg"))).toBe(
      `${OWNER}/${EVENT}/full/m.jpg`,
    );
    expect(safeKey(thumbKey(SCOPE, "m"))).toBe(
      `${OWNER}/${EVENT}/thumb/m.webp`,
    );
    expect(safeKey(posterKey(SCOPE, "m"))).toBe(
      `${OWNER}/${EVENT}/m-poster.webp`,
    );
  });
});
