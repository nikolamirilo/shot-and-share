import { beforeEach, describe, expect, it, vi } from "vitest";

import { countGuestMedia } from "@/lib/db/media-repo";

/**
 * The count is one RPC and the whole surface under test is what happens to its
 * answer, so the client is the answer.
 */
function answering(result: { data: unknown; error: { message: string } | null }) {
  return { rpc: async () => result } as never;
}

describe("counting an event's photographs", () => {
  beforeEach(() => {
    // The failure cases log, on purpose - a gallery quietly dropping its count
    // at every event is worth finding in a log. The test does not need to read
    // it.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reads a bigint that arrived as a string", async () => {
    // supabase-js hands bigint back as a string once it is large enough to
    // need to. No event gets there, and it costs nothing to be right about.
    expect(
      await countGuestMedia(answering({ data: "412", error: null }), "event"),
    ).toBe(412);
  });

  it("counts an event nobody has uploaded to yet as none", async () => {
    expect(
      await countGuestMedia(answering({ data: 0, error: null }), "event"),
    ).toBe(0);
  });

  /**
   * Migrations here are run by hand, so a deploy can reach a database that has
   * not been given the function yet. The gallery has to open anyway: the number
   * beside the heading is the least important thing on the page.
   */
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
    // Null is not zero. "0 so far" under a wall of photographs is worse than
    // no number at all.
    expect(
      await countGuestMedia(answering({ data: null, error: null }), "event"),
    ).toBeNull();
  });
});
