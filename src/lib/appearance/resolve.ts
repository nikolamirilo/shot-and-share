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
  type CoverVariant,
  DEFAULT_COVER,
  DEFAULT_UPLOAD,
  type UploadVariant,
  coerceCover,
  coerceUpload,
} from "@/lib/appearance/variants";
import type { FontSet } from "@/lib/fonts";
import { DEFAULT_FONT_ID, coerceFont, findFontSet } from "@/lib/fonts";
import type { GalleryLayout } from "@/lib/gallery";
import { DEFAULT_LAYOUT, coerceLayout } from "@/lib/gallery";
import { getTier } from "@/lib/tiers";

export interface Appearance {
  palette: Palette;
  themeId: string;
  font: FontSet;
  cover: CoverVariant;
  upload: UploadVariant;
  layout: GalleryLayout;
  /** Free events carry the Shot & Share header and footer. */
  platformBranding: boolean;
  /** Whether the host may change any of the above. */
  customisable: boolean;
}

interface AppearanceSource {
  tier: string;
  theme?: string | null;
  theme_custom?: unknown;
  theme_font?: string | null;
  cover_variant?: string | null;
  upload_variant?: string | null;
  gallery_layout?: string | null;
}

/**
 * The single source of truth for how an event page looks.
 *
 * Called by the guest page, the host preview and anything else that renders an
 * event. A free event gets the defaults here regardless of what is in its row,
 * which means a downgrade, a stale value or a hand-crafted request cannot buy
 * paid styling.
 */
export function resolveAppearance(event: AppearanceSource): Appearance {
  const tier = getTier(event.tier);

  if (!tier.customPage) {
    return {
      palette: THEMES[0].palette,
      themeId: DEFAULT_THEME_ID,
      font: findFontSet(DEFAULT_FONT_ID),
      cover: DEFAULT_COVER,
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
    upload: coerceUpload(event.upload_variant),
    layout: coerceLayout(event.gallery_layout),
    platformBranding: false,
    customisable: true,
  };
}
