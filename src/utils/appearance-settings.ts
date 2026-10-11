import {
  CUSTOM_THEME_ID,
  DEFAULT_THEME_ID,
  coerceCover,
  coercePosition,
  coerceUpload,
  findTheme,
} from "@/lib/appearance";
import { type EventRow } from "@/types/db";
import { DEFAULT_FONT_ID, coerceFont } from "@/lib/fonts";
import { APPEARANCE_DRAFT_PREFIX } from "@/constants/storage-keys";
import { coerceLayout } from "@/utils/gallery";
import { DEFAULT_COLOURS } from "@/constants/appearance";
import type { Settings } from "@/types/appearance";

export function draftKey(eventId: string) {
  return APPEARANCE_DRAFT_PREFIX + eventId;
}

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

function hex(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toUpperCase()
    : fallback;
}

export function readDraft(key: string): Settings | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
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
  }
}
