import type { CoverPosition, CoverVariant, UploadVariant } from "@/lib/appearance";
import { type GalleryLayout } from "@/constants/gallery";

export interface CustomColours {
  bg: string;
  surface: string;
  accent: string;
  ink: string;
}

/** Everything on the appearance panel a host can change, in one object. */
export interface Settings {
  theme: string;
  font: string;
  cover: CoverVariant;
  coverPosition: CoverPosition;
  upload: UploadVariant;
  layout: GalleryLayout;
  coverMediaId: string | null;
  colors: CustomColours;
}

export interface SaveState {
  status: "idle" | "saving" | "saved";
  error?: string;
}
