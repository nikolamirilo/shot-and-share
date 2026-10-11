import { beforeEach, describe, expect, it, vi } from "vitest";

const screen = vi.fn();

vi.mock("@/lib/moderation", () => ({
  screenObject: (key: string) => screen(key),
}));

const { decideReview, screenableKey } = await import("@/lib/moderation/review");

beforeEach(() => {
  screen.mockReset();
});

describe("which object gets screened", () => {
  it("screens a photo on its full copy", () => {
    expect(
      screenableKey({
        kind: "photo",
        media_key: "owner/event/abc.jpg",
        poster_key: null,
      }),
    ).toBe("owner/event/abc.jpg");
  });

  it("screens a video on its poster frame, never the clip", () => {
    expect(
      screenableKey({
        kind: "video",
        media_key: "owner/event/abc.mp4",
        poster_key: "owner/event/abc-poster.jpg",
      }),
    ).toBe("owner/event/abc-poster.jpg");
  });

  it("has nothing to screen when the only still is a webp", () => {
    expect(
      screenableKey({
        kind: "video",
        media_key: "owner/event/abc.mp4",
        poster_key: "owner/event/abc-poster.webp",
      }),
    ).toBeNull();
  });

  it("has nothing to screen for a HEIC the worker has not converted yet", () => {
    expect(
      screenableKey({
        kind: "photo",
        media_key: "owner/event/abc.heic",
        poster_key: null,
      }),
    ).toBeNull();
  });
});

describe("what a verdict does to a row", () => {
  it("approves a clean photo and records that it was checked", async () => {
    screen.mockResolvedValue({
      allowed: true,
      outcome: "clean",
      labels: [],
      provider: "rekognition",
    });

    const review = await decideReview({
      key: "owner/event/abc.jpg",
      requireApproval: false,
      autoScan: true,
    });

    expect(review.review_state).toBe("approved");
    expect(review.moderated_at).not.toBeNull();
    expect(review.moderation_labels).toEqual([]);
  });

  it("holds a flagged photo and keeps the labels that fired", async () => {
    screen.mockResolvedValue({
      allowed: false,
      outcome: "flagged",
      labels: [{ name: "Explicit", confidence: 96 }],
      provider: "rekognition",
    });

    const review = await decideReview({
      key: "owner/event/abc.jpg",
      requireApproval: false,
      autoScan: true,
    });

    expect(review.review_state).toBe("held");
    expect(review.moderation_labels).toEqual([
      { name: "Explicit", confidence: 96 },
    ]);
  });

  it("lets a photo through when the provider errors, and says nobody looked", async () => {
    screen.mockResolvedValue({
      allowed: true,
      outcome: "error",
      labels: [],
      provider: "rekognition",
    });

    const review = await decideReview({
      key: "owner/event/abc.jpg",
      requireApproval: false,
      autoScan: true,
    });

    expect(review.review_state).toBe("approved");
    expect(review.moderated_at).toBeNull();
    expect(review.moderation_labels).toBeNull();
  });
});

describe("the host's automatic-scan switch", () => {
  it("sends nothing to the provider while it is off", async () => {
    screen.mockResolvedValue({
      allowed: false,
      outcome: "flagged",
      labels: [{ name: "Explicit", confidence: 99 }],
      provider: "rekognition",
    });

    const review = await decideReview({
      key: "owner/event/abc.jpg",
      requireApproval: false,
      autoScan: false,
    });

    expect(screen).not.toHaveBeenCalled();
    expect(review.review_state).toBe("approved");
    expect(review.moderated_at).toBeNull();
    expect(review.moderation_labels).toBeNull();
  });

  it("still holds everything when the host asked for that, unscanned", async () => {
    const review = await decideReview({
      key: "owner/event/abc.jpg",
      requireApproval: true,
      autoScan: false,
    });

    expect(screen).not.toHaveBeenCalled();
    expect(review.review_state).toBe("held");
    expect(review.moderated_at).toBeNull();
  });
});

describe("the host's hold-everything switch", () => {
  it("holds a photo the check was perfectly happy with", async () => {
    screen.mockResolvedValue({
      allowed: true,
      outcome: "clean",
      labels: [],
      provider: "rekognition",
    });

    const review = await decideReview({
      key: "owner/event/abc.jpg",
      requireApproval: true,
      autoScan: true,
    });

    expect(review.review_state).toBe("held");
    expect(review.moderated_at).not.toBeNull();
  });
});
