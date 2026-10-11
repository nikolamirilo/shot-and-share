import { formatBytes } from "@/utils/format";
import type { Tier } from "@/lib/tiers";

export interface UploadWording {
  action: string;
  capture: string;
  choose: string;
  hint: string;
}

export function uploadWording(
  tier: Pick<Tier, "video" | "maxFileBytes">,
): UploadWording {
  return tier.video
    ? {
        action: "Add your photos and video",
        capture: "Open camera",
        choose: "Choose files",
        hint: `Photos and video, up to ${formatBytes(tier.maxFileBytes, 0)} a file.`,
      }
    : {
        action: "Add your photos",
        capture: "Take a photo",
        choose: "Choose photos",
        hint: `Photos, up to ${formatBytes(tier.maxFileBytes, 0)} a file.`,
      };
}

export const PREPARING = "Processing";
export const UPLOADING = "Uploading";

export function countLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`;
}
