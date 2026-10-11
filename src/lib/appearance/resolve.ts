import {
  type CustomThemeInput,
  buildCustomPalette,
} from "@/lib/appearance/custom-palette";
import {
  CUSTOM_THEME_ID,
  DEFAULT_THEME_ID,
  type Palette,
  THEMES,
  findTheme,
} from "@/lib/appearance/themes";
import {
  type CoverPosition,
  type CoverVariant,
  DEFAULT_COVER,
  DEFAULT_POSITION,
  DEFAULT_UPLOAD,
  type UploadVariant,
  coerceCover,
  coercePosition,
  coerceUpload,
} from "@/lib/appearance/variants";
import type { FontSet } from "@/lib/fonts";
import { DEFAULT_FONT_ID, coerceFont, findFontSet } from "@/lib/fonts";
import { type GalleryLayout } from "@/constants/gallery";
import { DEFAULT_LAYOUT } from "@/constants/gallery";
import { coerceLayout } from "@/utils/gallery";
import { getTier } from "@/lib/tiers";

export interface Appearance {
  palette: Palette;
  themeId: string;
  font: FontSet;
  cover: CoverVariant;
  coverPosition: CoverPosition;
  upload: UploadVariant;
  layout: GalleryLayout;
  platformBranding: boolean;
  customisable: boolean;
}

interface AppearanceSource {
  tier: string;
  theme?: string | null;
  theme_custom?: unknown;
  theme_font?: string | null;
  cover_variant?: string | null;
  cover_position?: string | null;
  upload_variant?: string | null;
  gallery_layout?: string | null;
}

export function resolveAppearance(event: AppearanceSource): Appearance {
  const tier = getTier(event.tier);

  if (!tier.customPage) {
    return {
      palette: THEMES[0].palette,
      themeId: DEFAULT_THEME_ID,
      font: findFontSet(DEFAULT_FONT_ID),
      cover: DEFAULT_COVER,
      coverPosition: DEFAULT_POSITION,
      upload: DEFAULT_UPLOAD,
      layout: DEFAULT_LAYOUT,
      platformBranding: true,
      customisable: false,
    };
  }

  const themeId = event.theme ?? DEFAULT_THEME_ID;
  const palette =
    themeId === CUSTOM_THEME_ID
      ? buildCustomPalette((event.theme_custom ?? {}) as CustomThemeInput)
      : findTheme(themeId).palette;

  return {
    palette,
    themeId,
    font: findFontSet(coerceFont(event.theme_font)),
    cover: coerceCover(event.cover_variant),
    coverPosition: coercePosition(event.cover_position),
    upload: coerceUpload(event.upload_variant),
    layout: coerceLayout(event.gallery_layout),
    platformBranding: false,
    customisable: true,
  };
}
