import { beforeEach, describe, expect, it, vi } from "vitest";

import { countGuestMedia } from "@/lib/db/media-repo";

function answering(result: { data: unknown; error: { message: string } | null }) {
  return { rpc: async () => result } as never;
}

describe("counting an event's photographs", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reads a bigint that arrived as a string", async () => {
    expect(
      await countGuestMedia(answering({ data: "412", error: null }), "event"),
    ).toBe(412);
  });

  it("counts an event nobody has uploaded to yet as none", async () => {
    expect(
      await countGuestMedia(answering({ data: 0, error: null }), "event"),
    ).toBe(0);
  });

  it("gives up rather than fail when the function is not there", async () => {
    expect(
      await countGuestMedia(
        answering({
          data: null,
          error: { message: "function public.event_media_count does not exist" },
        }),
        "event",
      ),
    ).toBeNull();
  });

  it("gives up rather than call an unanswered question zero", async () => {
    expect(
      await countGuestMedia(answering({ data: null, error: null }), "event"),
    ).toBeNull();
  });
});
