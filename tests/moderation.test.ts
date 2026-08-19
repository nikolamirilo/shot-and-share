import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The upload screening.
 *
 * Three things have to hold, and only one of them is "flagged photos get held".
 * The other two are the ones that would hurt: an unconfigured deployment must
 * still take uploads, and a provider that falls over must not stop a wedding.
 */

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

  /*
   * The reason POSTER_IMAGE_FORMATS exists. A WebP poster is unscreenable, and
   * a video that silently skips the check is exactly the gap this closes.
   */
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
    });

    expect(review.review_state).toBe("approved");
    expect(review.moderated_at).not.toBeNull();
    // An empty array is a clean pass. Null would mean nobody looked.
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
    });

    expect(review.review_state).toBe("held");
    expect(review.moderation_labels).toEqual([
      { name: "Explicit", confidence: 96 },
    ]);
  });

  /*
   * The one that keeps a wedding running. An AWS outage at 11pm has to mean
   * "nobody screened this", not "nobody can upload".
   */
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
    });

    expect(review.review_state).toBe("approved");
    expect(review.moderated_at).toBeNull();
    expect(review.moderation_labels).toBeNull();
  });

  it("lets a photo through when there is nothing configured to screen it", async () => {
    screen.mockResolvedValue({
      allowed: true,
      outcome: "skipped",
      labels: [],
      provider: "none",
    });

    const review = await decideReview({
      key: "owner/event/abc.jpg",
      requireApproval: false,
    });

    expect(review.review_state).toBe("approved");
    expect(review.moderated_at).toBeNull();
  });

  it("does not call the provider at all when there is no screenable object", async () => {
    const review = await decideReview({ key: null, requireApproval: false });

    expect(screen).not.toHaveBeenCalled();
    expect(review.review_state).toBe("approved");
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
    });

    expect(review.review_state).toBe("held");
    // Still screened, so the host is told which of four hundred to look at
    // first rather than facing an undifferentiated queue.
    expect(review.moderated_at).not.toBeNull();
  });

  it("holds a photo that could not be screened at all", async () => {
    const review = await decideReview({ key: null, requireApproval: true });
    expect(review.review_state).toBe("held");
  });
});
