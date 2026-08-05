"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { updateAppearance, type ActionState } from "@/app/dashboard/actions";
import { EventCover, EventThemeRoot } from "@/components/event-cover";
import { Badge, Button, ButtonLink, cx } from "@/components/ui";
import { UploadPanel } from "@/components/upload-panel";
import {
  COVER_VARIANTS,
  CUSTOM_THEME_ID,
  type CoverVariant,
  THEMES,
  UPLOAD_VARIANTS,
  type UploadVariant,
  buildCustomPalette,
  findTheme,
} from "@/lib/appearance";
import { AA_CONTRAST, contrastRatio, parseHex } from "@/lib/color";
import type { EventRow } from "@/lib/db/types";
import type { MediaView } from "@/lib/events";
import { FONT_SETS, findFontSet, googleFontsHref } from "@/lib/fonts";
import { GALLERY_LAYOUTS, type GalleryLayout } from "@/lib/gallery";
import { MAX_FILES_PER_REQUEST } from "@/lib/media";
import { getTier } from "@/lib/tiers";

/**
 * The custom event page editor.
 *
 * Everything is previewed live against the host's own cover photo, because the
 * only useful answer to "what does Midnight look like?" is to show it. The
 * preview renders the real EventCover and the real UploadPanel inside a real
 * EventThemeRoot, so what a host approves here is what a guest gets.
 *
 * That is a rule rather than a detail. The parts of this preview that were once
 * drawn by hand - a dark bar standing in for the uploader, four dark tiles
 * standing in for photos - were exactly the parts that stopped agreeing with
 * the page: a hand-drawn panel has no card surface on it, so the "Cards" colour
 * had nothing to colour.
 */
export function AppearanceForm({
  event,
  media,
  locked,
}: {
  event: EventRow;
  media: MediaView[];
  /** Free plan: the whole thing is an upsell rather than a form. */
  locked: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateAppearance.bind(null, event.id),
    {},
  );

  const custom = (event.theme_custom ?? {}) as Record<string, string>;
  const [themeId, setThemeId] = useState(event.theme ?? "cheese");
  const [fontId, setFontId] = useState(event.theme_font ?? "cheese");
  const [cover, setCover] = useState<CoverVariant>(
    (event.cover_variant as CoverVariant) ?? "classic",
  );
  const [upload, setUpload] = useState<UploadVariant>(
    (event.upload_variant as UploadVariant) ?? "button",
  );
  const [layout, setLayout] = useState<GalleryLayout>(event.gallery_layout);
  const [coverMediaId, setCoverMediaId] = useState<string | null>(
    event.cover_media_id,
  );
  const [colors, setColors] = useState({
    bg: custom.bg ?? "#FFF6DC",
    surface: custom.surface ?? "#FFFDF4",
    accent: custom.accent ?? "#FFC02E",
    ink: custom.ink ?? "#1F1607",
  });

  const palette =
    themeId === CUSTOM_THEME_ID
      ? buildCustomPalette(colors)
      : findTheme(themeId).palette;

  const font = findFontSet(fontId);

  const coverUrl =
    media.find((m) => m.id === coverMediaId)?.thumbUrl ?? null;

  // A photo cover with no photo falls back to "Just type" on the guest page, so
  // the host is told rather than left to discover it after the invitations go
  // out. The preview above still shows the shape they picked.
  const coverNeedsPhoto = cover !== "type" && !coverUrl;

  if (locked) return <LockedPanel eventId={event.id} />;

  return (
    <section className="card p-6">
      {/* Every pairing, not just the chosen one: the host is comparing them,
          and a font that arrives half a second after the click reads as the
          preview being broken. A guest page loads only its own. */}
      {FONT_SETS.map((set) => {
        const href = googleFontsHref(set);
        return href ? (
          <link
            key={set.id}
            rel="stylesheet"
            href={href}
            precedence="default"
          />
        ) : null;
      })}

      <h2 className="text-h3">The event page</h2>
      <p className="mt-2 text-[0.9375rem] text-crust">
        What guests see when they scan the code. Everything here is previewed
        with your own photo.
      </p>

      {/* --- live preview -------------------------------------------------
          The real components, in a real theme root. A mock-up here is how a
          setting ends up looking dead: the panels below are the same ones the
          guest gets, so a colour that does nothing visible in this box does
          nothing on the page either. */}
      <div className="mt-5 overflow-hidden rounded-xl border-2 border-pepper">
        <EventThemeRoot palette={palette} font={font}>
          <EventCover
            variant={cover}
            name={event.name || "Your event"}
            date={event.event_date}
            coverUrl={coverUrl}
            palette={palette}
            preview
          />
          <div className="px-4 py-4">
            <UploadPanel
              variant={upload}
              label="Add your photos"
              hint={
                getTier(event.tier).video
                  ? `Photos and video, up to ${MAX_FILES_PER_REQUEST} at a time.`
                  : `Photos, up to ${MAX_FILES_PER_REQUEST} at a time.`
              }
              name=""
              preview
            />
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={cx(
                    "aspect-square",
                    layout === "holes" ? "hole" : "recess",
                  )}
                />
              ))}
            </div>
          </div>
        </EventThemeRoot>
      </div>

      <form action={formAction} className="mt-6 space-y-6">
        <input type="hidden" name="theme" value={themeId} />
        <input type="hidden" name="theme_font" value={fontId} />
        <input type="hidden" name="cover_variant" value={cover} />
        <input type="hidden" name="upload_variant" value={upload} />
        <input type="hidden" name="gallery_layout" value={layout} />
        <input
          type="hidden"
          name="cover_media_id"
          value={coverMediaId ?? ""}
        />
        {Object.entries(colors).map(([key, value]) => (
          <input key={key} type="hidden" name={`custom_${key}`} value={value} />
        ))}

        <Group label="Theme">
          <div className="flex flex-wrap gap-2">
            {THEMES.map((theme) => (
              <Swatch
                key={theme.id}
                selected={themeId === theme.id}
                onClick={() => setThemeId(theme.id)}
                title={theme.hint}
                name={theme.name}
                colors={[
                  theme.palette.bg,
                  theme.palette.accent,
                  theme.palette.ink,
                ]}
              />
            ))}
            <Swatch
              selected={themeId === CUSTOM_THEME_ID}
              onClick={() => setThemeId(CUSTOM_THEME_ID)}
              title="Pick your own colours"
              name="Custom"
              colors={[colors.bg, colors.accent, colors.ink]}
            />
          </div>
        </Group>

        {themeId === CUSTOM_THEME_ID && (
          <CustomColours colors={colors} onChange={setColors} />
        )}

        <Group label="Type" hint="Pairs a heading face with a body face.">
          <div className="grid gap-2 sm:grid-cols-2">
            {FONT_SETS.map((set) => (
              <button
                key={set.id}
                type="button"
                onClick={() => setFontId(set.id)}
                aria-pressed={fontId === set.id}
                className={cx(
                  "rounded-xl border-2 border-pepper p-3 text-left",
                  fontId === set.id ? "bg-gouda" : "bg-butter",
                )}
              >
                {/* The name is set in the face it names. Nothing else here
                    answers "what does Warm look like?" as quickly. */}
                <span
                  className="block text-h3 leading-none"
                  style={{
                    fontFamily: set.display,
                    fontWeight: set.displayWeight,
                    fontStretch: set.displayStretch,
                    letterSpacing: set.displayTracking,
                  }}
                >
                  {set.name}
                </span>
                <span
                  className="mt-1.5 block text-[0.8125rem] leading-snug text-crust"
                  style={{ fontFamily: set.body }}
                >
                  {set.hint}
                </span>
              </button>
            ))}
          </div>
        </Group>

        <Group label="Cover style">
          <div className="grid gap-2 sm:grid-cols-2">
            {COVER_VARIANTS.map((option) => (
              <Choice
                key={option.id}
                selected={cover === option.id}
                onClick={() => setCover(option.id)}
                name={option.name}
                hint={option.hint}
              />
            ))}
          </div>
        </Group>

        <Group label="Asking for photos">
          <div className="grid gap-2 sm:grid-cols-2">
            {UPLOAD_VARIANTS.map((option) => (
              <Choice
                key={option.id}
                selected={upload === option.id}
                onClick={() => setUpload(option.id)}
                name={option.name}
                hint={option.hint}
              />
            ))}
          </div>
        </Group>

        <Group
          label="Cover photo"
          hint={
            media.length === 0
              ? "Once photos arrive you can pick one for the cover."
              : "Pick any photo from the event."
          }
        >
          {coverNeedsPhoto && (
            <p className="mb-2.5 rounded-xl border-2 border-dashed border-rind p-3 text-[0.8125rem] leading-snug text-crust">
              No cover photo yet. Until you pick one, guests get the{" "}
              <strong>Just type</strong> cover rather than the one above.
            </p>
          )}

          {media.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCoverMediaId(null)}
                className={cx(
                  "h-14 w-14 rounded-lg border-2 border-pepper text-[0.6875rem] font-mono uppercase",
                  coverMediaId === null ? "bg-gouda" : "bg-butter",
                )}
              >
                none
              </button>
              {media.slice(0, 24).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCoverMediaId(item.id)}
                  aria-pressed={coverMediaId === item.id}
                  className={cx(
                    "h-14 w-14 overflow-hidden rounded-lg border-2 border-pepper",
                    coverMediaId === item.id &&
                      "ring-4 ring-pepper ring-offset-2 ring-offset-cream",
                  )}
                >
                  {item.thumbUrl && (
                    <img
                      src={item.thumbUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </Group>

        <Group label="Gallery layout">
          <div className="grid gap-2 sm:grid-cols-2">
            {GALLERY_LAYOUTS.map((option) => (
              <Choice
                key={option.id}
                selected={layout === option.id}
                onClick={() => setLayout(option.id)}
                name={option.name}
                hint={option.hint}
              />
            ))}
          </div>
        </Group>

        {state.error && (
          <p className="rounded-xl border-2 border-pepper bg-butter p-3 text-[0.9375rem] font-semibold">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="rounded-xl border-2 border-pepper bg-gouda p-3 text-[0.9375rem]">
            Saved. Guests see this now.
          </p>
        )}

        <Save />
      </form>
    </section>
  );
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save the page"}
    </Button>
  );
}

function Group({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
        {label}
      </p>
      {hint && <p className="mt-1 text-[0.8125rem] text-crust">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function Swatch({
  selected,
  onClick,
  name,
  title,
  colors,
}: {
  selected: boolean;
  onClick: () => void;
  name: string;
  title: string;
  colors: string[];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={selected}
      className={cx(
        "rounded-xl border-2 border-pepper px-2.5 py-2 text-left transition-transform",
        selected ? "bg-gouda shadow-[3px_3px_0_var(--color-pepper)]" : "bg-butter",
      )}
    >
      <span className="flex gap-1">
        {colors.map((c) => (
          <span
            key={c}
            className="h-5 w-5 rounded-full border border-pepper/40"
            style={{ background: c }}
          />
        ))}
      </span>
      <span className="mt-1.5 block text-[0.8125rem] font-semibold">{name}</span>
    </button>
  );
}

function Choice({
  selected,
  onClick,
  name,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  name: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        "rounded-xl border-2 border-pepper p-3 text-left",
        selected ? "bg-gouda" : "bg-butter",
      )}
    >
      <span className="block font-bold">{name}</span>
      <span className="mt-0.5 block text-[0.8125rem] leading-snug text-crust">
        {hint}
      </span>
    </button>
  );
}

/**
 * Custom colours, with a live contrast reading.
 *
 * A host cannot be expected to know about WCAG ratios, and their guests will be
 * reading this on a phone in a dark room. The text colour is corrected
 * automatically when it fails - this panel exists so the host is told rather
 * than quietly overridden.
 */
interface CustomColours {
  bg: string;
  surface: string;
  accent: string;
  ink: string;
}

function CustomColours({
  colors,
  onChange,
}: {
  colors: CustomColours;
  onChange: (next: CustomColours) => void;
}) {
  const fg = parseHex(colors.ink);
  const bg = parseHex(colors.bg);
  const ratio = fg && bg ? contrastRatio(fg, bg) : 0;
  const readable = ratio >= AA_CONTRAST;

  const fields: Array<[keyof CustomColours, string]> = [
    ["bg", "Background"],
    ["surface", "Cards"],
    ["accent", "Accent"],
    ["ink", "Text"],
  ];

  return (
    <div className="rounded-xl border-2 border-dashed border-rind p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {fields.map(([key, label]) => (
          <label key={key} className="block">
            <span className="block text-[0.8125rem] font-semibold">{label}</span>
            <span className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={colors[key]}
                onChange={(e) => onChange({ ...colors, [key]: e.target.value })}
                className="h-9 w-9 cursor-pointer rounded border-2 border-pepper bg-transparent p-0"
                aria-label={label}
              />
              <span className="font-mono text-[0.6875rem] uppercase tracking-wider">
                {colors[key]}
              </span>
            </span>
          </label>
        ))}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.8125rem]">
        <Badge tone={readable ? "gouda" : "outline"}>
          contrast {ratio.toFixed(1)}:1
        </Badge>
        <span className="text-crust">
          {readable
            ? "Comfortable to read on a phone."
            : "Too low to read comfortably. We will darken or lighten your text colour automatically - pick a stronger one to keep the shade you want."}
        </span>
      </p>
    </div>
  );
}

function LockedPanel({ eventId }: { eventId: string }) {
  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3">The event page</h2>
        <Badge tone="outline">Slice and Wheel</Badge>
      </div>

      <p className="mt-3 text-[0.9375rem] leading-relaxed text-crust">
        On the free plan your guests see the Say Cheese theme, a fixed cover and
        a fixed gallery, with a small header and footer pointing back to us.
        Everything works - it just looks like ours rather than yours.
      </p>

      <ul className="mt-4 space-y-2">
        {[
          "Five themes, or pick your own colours",
          "Five type pairings, from formal to loud",
          "Four cover styles, using any photo from the event",
          "Four ways to ask your guests for photos",
          "Choose how the gallery is laid out",
          "No Say Cheese header or footer",
        ].map((line) => (
          <li key={line} className="flex items-start gap-2.5">
            <span className="hole mt-2 h-2.5 w-2.5 shrink-0" />
            <span className="text-[0.9375rem] leading-snug">{line}</span>
          </li>
        ))}
      </ul>

      <ButtonLink href={`/dashboard/events/${eventId}#upgrade`} className="mt-5">
        See the plans
      </ButtonLink>
    </section>
  );
}
