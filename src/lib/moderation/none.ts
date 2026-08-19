import type { ModerationDriver, ModerationVerdict } from "@/lib/moderation/types";

/**
 * The driver used when nothing is configured.
 *
 * Every deployment without AWS credentials runs on this: a developer's laptop,
 * a preview build, the test suite. It passes everything and says so, which is
 * why `moderated_at` stays null rather than recording a pass that never
 * happened.
 */
export const noModeration: ModerationDriver = {
  name: "none",
  async screen(): Promise<ModerationVerdict> {
    return {
      allowed: true,
      outcome: "skipped",
      labels: [],
      provider: "none",
    };
  },
};
