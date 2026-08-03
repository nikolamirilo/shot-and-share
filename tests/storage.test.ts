import { rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, describe, expect, it } from "vitest";

import { localDriver, safeKey, signLocal, verifyLocal } from "@/lib/storage/local";
import { archiveKey, originalKey, thumbKey } from "@/lib/media";

const EVENT = "test-event-0001";

afterAll(async () => {
  await rm(path.join(process.cwd(), ".storage", "events", EVENT), {
    recursive: true,
    force: true,
  });
});

describe("local storage driver", () => {
  it("round-trips an object", async () => {
    const key = originalKey(EVENT, "media-1", "jpg");
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
    const key = archiveKey(EVENT);
    await localDriver.put({
      key,
      body: Readable.from([Buffer.from("PK"), Buffer.from("zip")]),
      contentType: "application/zip",
    });
    expect((await localDriver.head(key))?.size).toBe(5);
  });

  it("reports a missing object as null rather than throwing", async () => {
    expect(await localDriver.head("events/nope/originals/nope.jpg")).toBeNull();
  });

  it("removes a whole event prefix", async () => {
    await localDriver.put({
      key: thumbKey(EVENT, "media-1"),
      body: Buffer.from("thumb"),
      contentType: "image/webp",
    });

    const removed = await localDriver.removePrefix(`events/${EVENT}/`);
    expect(removed).toBeGreaterThanOrEqual(2);
    expect(await localDriver.head(originalKey(EVENT, "media-1", "jpg"))).toBeNull();
  });

  it("returns 0 for a prefix that does not exist", async () => {
    expect(await localDriver.removePrefix("events/never-existed/")).toBe(0);
  });
});

describe("local presigning", () => {
  it("signs an upload with a size limit and an expiry", async () => {
    const presigned = await localDriver.presignUpload({
      key: originalKey(EVENT, "media-2", "jpg"),
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
    const sig = signLocal(["put", "events/a/originals/1.jpg", "999", "100", "image/jpeg"]);

    // Swapping the key would let anyone overwrite another event's object.
    expect(verifyLocal(["put", "events/b/originals/1.jpg", "999", "100", "image/jpeg"], sig)).toBe(false);
    // Raising the limit is the whole reason the size is in the signature.
    expect(verifyLocal(["put", "events/a/originals/1.jpg", "999", "999999999", "image/jpeg"], sig)).toBe(false);
    expect(verifyLocal(["put", "events/a/originals/1.jpg", "999", "100", "text/html"], sig)).toBe(false);
    expect(verifyLocal(["put", "events/a/originals/1.jpg", "999", "100", "image/jpeg"], "")).toBe(false);
  });

  it("signs downloads separately from uploads", async () => {
    const url = await localDriver.presignDownload({
      key: originalKey(EVENT, "media-2", "jpg"),
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
    expect(() => safeKey("events/a/../../../secrets")).toThrow();
  });

  it("allows the keys the application actually generates", () => {
    expect(safeKey(originalKey(EVENT, "m", "jpg"))).toBe(
      `events/${EVENT}/originals/m.jpg`,
    );
    expect(safeKey(thumbKey(EVENT, "m"))).toBe(`events/${EVENT}/thumbs/m.webp`);
  });
});
