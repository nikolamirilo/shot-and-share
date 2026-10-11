import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  UploadError,
  gate,
  getFingerprint,
  postJson,
  uploadToPresigned,
  withRetry,
} from "@/lib/client/upload";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("gate", () => {
  it("never runs more than its size at once, and finishes everything", async () => {
    const pass = gate(2);
    let active = 0;
    let peak = 0;
    let done = 0;

    await Promise.all(
      Array.from({ length: 6 }, () =>
        pass(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await wait(5);
          active -= 1;
          done += 1;
        }),
      ),
    );

    expect(peak).toBe(2);
    expect(done).toBe(6);
  });

  it("gives the slot back when a task throws", async () => {
    const pass = gate(1);

    await expect(
      pass(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    let ran = false;
    await pass(async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });
});

describe("getFingerprint", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("works where randomUUID is not available", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (array: Uint8Array) => {
        array.fill(7);
        return array;
      },
    });

    const id = getFingerprint();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(getFingerprint()).toBe(id);
  });

  it("still returns an id when storage itself throws", () => {
    vi.stubGlobal("crypto", {});
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("private mode");
      },
      setItem() {
        throw new Error("private mode");
      },
    });

    expect(getFingerprint()).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("tries three times before giving up on a retryable failure", async () => {
    const task = vi.fn(async () => {
      throw new UploadError("the connection dropped", true);
    });

    const settled = withRetry(task).catch((error) => error);
    await vi.runAllTimersAsync();

    expect(await settled).toBeInstanceOf(UploadError);
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("succeeds on the second attempt without bothering the guest", async () => {
    let attempts = 0;
    const task = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new UploadError("dropped", true);
      return "landed";
    });

    const settled = withRetry(task);
    await vi.runAllTimersAsync();

    expect(await settled).toBe("landed");
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("does not retry a failure that will not change", async () => {
    const task = vi.fn(async () => {
      throw new UploadError("Storage rejected the upload - AccessDenied", false);
    });

    await expect(withRetry(task)).rejects.toThrow("AccessDenied");
    expect(task).toHaveBeenCalledTimes(1);
  });
});

describe("postJson", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const respond = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  it("returns the parsed body on success", async () => {
    fetchMock.mockResolvedValue(respond(200, { confirmed: true }));
    await expect(postJson("/api/upload/confirm", {})).resolves.toEqual({
      confirmed: true,
    });
  });

  it("throws the server's own message rather than swallowing it", async () => {
    fetchMock.mockResolvedValue(
      respond(413, { error: { message: "This event is full.", upgrade: true } }),
    );

    const error = (await postJson("/api/upload/presign", {}).catch(
      (e) => e,
    )) as UploadError;

    expect(error).toBeInstanceOf(UploadError);
    expect(error.message).toBe("This event is full.");
    expect(error.upgrade).toBe(true);
    expect(error.retryable).toBe(false);
  });

  it("survives an error page that is not JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>502 Bad Gateway</html>", { status: 502 }),
    );

    await expect(postJson("/x", {})).rejects.toMatchObject({
      message: "Request failed (HTTP 502).",
      retryable: true,
    });
  });

  it("treats a request that never arrived as worth retrying", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(postJson("/x", {})).rejects.toMatchObject({
      retryable: true,
    });
  });
});

describe("uploadToPresigned", () => {
  const presigned = {
    url: "https://bucket.example/",
    fields: { key: "owner/event/media.webp" },
    fileField: "file",
  };

  interface FakeXhr {
    upload: { onprogress?: (e: unknown) => void; onload?: () => void };
    onload?: () => void;
    onerror?: () => void;
    onabort?: () => void;
    status: number;
    responseText: string;
    aborted: boolean;
    open(): void;
    send(): void;
    abort(): void;
  }

  let sent: FakeXhr | null = null;

  /**
   * A constructor returning an object literal rather than a class, so the test can hold
   * a reference to the instance.
   */
  function FakeXhrCtor(this: unknown): FakeXhr {
    const xhr: FakeXhr = {
      upload: {},
      status: 0,
      responseText: "",
      aborted: false,
      open() {},
      send() {
        sent = xhr;
      },
      abort() {
        xhr.aborted = true;
        xhr.onabort?.();
      },
    };
    return xhr;
  }

  beforeEach(() => {
    sent = null;
    vi.stubGlobal("XMLHttpRequest", FakeXhrCtor);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const body = () => new Blob(["bytes"], { type: "image/webp" });

  it("names the reason S3 gave, and does not retry it", async () => {
    const promise = uploadToPresigned(presigned, body());
    sent!.status = 403;
    sent!.responseText =
      "<Error><Code>AccessDenied</Code><Message>policy</Message></Error>";
    sent!.onload!();

    const error = await promise.catch((e) => e);
    expect(error.message).toBe(
      "Storage rejected the upload - AccessDenied: policy",
    );
    expect(error.retryable).toBe(false);
  });

  it("treats a bucket 5xx as worth another go", async () => {
    const promise = uploadToPresigned(presigned, body());
    sent!.status = 503;
    sent!.onload!();

    await expect(promise).rejects.toMatchObject({ retryable: true });
  });

  it("treats a dropped connection as worth another go", async () => {
    const promise = uploadToPresigned(presigned, body());
    sent!.status = 0;
    sent!.onerror!();

    await expect(promise).rejects.toMatchObject({ retryable: true });
  });

  it("gives up on an upload that stops making progress", async () => {
    vi.useFakeTimers();
    try {
      const promise = uploadToPresigned(presigned, body());
      const failure = promise.catch((e) => e);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(sent!.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(40_000);

      const error = await failure;
      expect(error.message).toBe("The connection stopped responding.");
      expect(error.retryable).toBe(true);
      expect(sent!.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps waiting while the bytes are still moving", async () => {
    vi.useFakeTimers();
    try {
      const promise = uploadToPresigned(presigned, body(), () => {});
      let settled = false;
      promise.then(
        () => (settled = true),
        () => (settled = true),
      );

      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(30_000);
        sent!.upload.onprogress?.({ lengthComputable: true, loaded: i, total: 5 });
      }

      expect(settled).toBe(false);
      expect(sent!.aborted).toBe(false);

      sent!.status = 204;
      sent!.onload!();
      await promise;
    } finally {
      vi.useRealTimers();
    }
  });
});
