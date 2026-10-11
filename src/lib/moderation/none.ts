import type { ModerationDriver, ModerationVerdict } from "@/lib/moderation/types";

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
