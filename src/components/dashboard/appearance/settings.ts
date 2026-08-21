import {
  CUSTOM_THEME_ID,
  type CoverPosition,
  type CoverVariant,
  DEFAULT_THEME_ID,
  type UploadVariant,
  coerceCover,
  coercePosition,
  coerceUpload,
  findTheme,
} from "@/lib/appearance";
import type { EventRow } from "@/lib/db/types";
import { DEFAULT_FONT_ID, coerceFont } from "@/lib/fonts";
import { type GalleryLayout, coerceLayout } from "@/lib/gallery";

/** Where a host's unsaved edits wait while the tab is closed. */
const DRAFT_PREFIX = "shotAndShare:appearance:";

export function draftKey(eventId: string) {
  return DRAFT_PREFIX + eventId;
}

export interface CustomColours {
  bg: string;
  surface: string;
  accent: string;
  ink: string;
}

export const DEFAULT_COLOURS: CustomColours = {
  bg: "#FFF6DC",
  surface: "#FFFDF4",
  accent: "#FFC02E",
  ink: "#1F1607",
};

/** Everything on this panel a host can change, in one object. */
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

/**
 * What the database holds, as this panel sees it.
 *
 * Variants are coerced rather than cast: a row can hold one that no longer
 * exists - "framed" until its migration lands, or after a restore - and putting
 * that in state means a preview of the wrong shape and a save the server
 * rejects. The host lands on the default instead, and because this is also the
 * baseline the count is measured against, such a row reads as one change
 * waiting rather than being written back silently.
 */
export function fromEvent(event: EventRow): Settings {
  const custom = (event.theme_custom ?? {}) as Record<string, string>;
  return {
    theme: event.theme ?? DEFAULT_THEME_ID,
    font: event.theme_font ?? DEFAULT_FONT_ID,
    cover: coerceCover(event.cover_variant),
    coverPosition: coercePosition(event.cover_position),
    upload: coerceUpload(event.upload_variant),
    layout: coerceLayout(event.gallery_layout),
    coverMediaId: event.cover_media_id,
    colors: {
      bg: hex(custom.bg, DEFAULT_COLOURS.bg),
      surface: hex(custom.surface, DEFAULT_COLOURS.surface),
      accent: hex(custom.accent, DEFAULT_COLOURS.accent),
      ink: hex(custom.ink, DEFAULT_COLOURS.ink),
    },
  };
}

/** The payload the action takes. */
export function toFields(s: Settings): Record<string, string> {
  return {
    theme: s.theme,
    theme_font: s.font,
    cover_variant: s.cover,
    cover_position: s.coverPosition,
    upload_variant: s.upload,
    gallery_layout: s.layout,
    cover_media_id: s.coverMediaId ?? "",
    custom_bg: s.colors.bg,
    custom_surface: s.colors.surface,
    custom_accent: s.colors.accent,
    custom_ink: s.colors.ink,
  };
}

/**
 * How many changes are waiting.
 *
 * Counted in the host's units rather than the database's: the four custom
 * colours are one decision and one line in the preview, so picking a palette
 * is one change rather than four.
 */
export function countChanges(a: Settings, b: Settings): number {
  let n = 0;
  if (a.theme !== b.theme) n += 1;
  if (a.font !== b.font) n += 1;
  if (a.cover !== b.cover) n += 1;
  if (a.coverPosition !== b.coverPosition) n += 1;
  if (a.upload !== b.upload) n += 1;
  if (a.layout !== b.layout) n += 1;
  if (a.coverMediaId !== b.coverMediaId) n += 1;
  if (JSON.stringify(a.colors) !== JSON.stringify(b.colors)) n += 1;
  return n;
}

/** `<input type="color">` will only take this shape, so nothing else gets in. */
function hex(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toUpperCase()
    : fallback;
}

export function readDraft(key: string): Settings | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    // Whatever is in there may have been written by an older version of this
    // page, so every field goes through the same coercion a database row does.
    const draft = JSON.parse(raw) as Partial<Settings>;
    return {
      theme:
        draft.theme === CUSTOM_THEME_ID
          ? CUSTOM_THEME_ID
          : findTheme(draft.theme).id,
      font: coerceFont(draft.font),
      cover: coerceCover(draft.cover),
      coverPosition: coercePosition(draft.coverPosition),
      upload: coerceUpload(draft.upload),
      layout: coerceLayout(draft.layout),
      coverMediaId:
        typeof draft.coverMediaId === "string" ? draft.coverMediaId : null,
      colors: {
        bg: hex(draft.colors?.bg, DEFAULT_COLOURS.bg),
        surface: hex(draft.colors?.surface, DEFAULT_COLOURS.surface),
        accent: hex(draft.colors?.accent, DEFAULT_COLOURS.accent),
        ink: hex(draft.colors?.ink, DEFAULT_COLOURS.ink),
      },
    };
  } catch {
    return null;
  }
}

export function writeDraft(key: string, settings: Settings, saved: Settings) {
  try {
    if (countChanges(settings, saved) === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(settings));
  } catch {
    // Private mode. The edits still work; they just do not survive the tab.
  }
}
