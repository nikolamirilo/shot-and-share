"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { updateAppearance, type ActionState } from "@/app/dashboard/actions";
import { EventPreview } from "@/components/event-preview";
import { TabPanel, Tabs, type TabItem } from "@/components/tabs";
import { Badge, Button, ButtonLink, cx } from "@/components/ui";
import {
  COVER_VARIANTS,
  CUSTOM_THEME_ID,
  type CoverVariant,
  THEMES,
  UPLOAD_VARIANTS,
  type UploadVariant,
  buildCustomPalette,
  coerceCover,
  coerceUpload,
  findTheme,
  lightBackground,
} from "@/lib/appearance";
import { AA_CONTRAST, contrastRatio, parseHex } from "@/lib/color";
import type { EventRow } from "@/lib/db/types";
import type { MediaView } from "@/lib/events";
import { FONT_SETS, findFontSet, googleFontsHref } from "@/lib/fonts";
import { GALLERY_LAYOUTS, type GalleryLayout } from "@/lib/gallery";
import { MAX_FILES_PER_PICK } from "@/lib/media";
import { getTier } from "@/lib/tiers";

/**
 * The custom event page editor.
 *
 * Every choice is judged against a drawing of the whole guest page - browser
 * frame, header, cover, ask, gallery, small print - because the only useful
 * answer to "what does Midnight look like?" is a page, and a swatch of a page
 * cannot give it. See EventPreview: it is the real components inside the real
 * EventThemeRoot, with the photographs left as empty frames.
 *
 * That is a rule rather than a detail. The parts of this preview that were once
 * drawn by hand - a dark bar standing in for the uploader, four dark tiles
 * standing in for a gallery - were exactly the parts that stopped agreeing with
 * the page: a hand-drawn panel has no card surface on it, so the "Cards" colour
 * had nothing to colour, and four identical squares said the same thing about
 * all four gallery layouts.
 *
 * Six groups of options stacked under that preview is the longest scroll in the
 * product, and on a phone it put the gallery layout about four screens below
 * the thing it changes. Below `lg` the groups become tabs directly under the
 * preview, so every choice is one tap away and the preview it is judged
 * against stays on screen. On a laptop the column is short enough to read at
 * once and they all stay open.
 */
const LOOK_TABS: TabItem[] = [
  { id: "theme", label: "Colour" },
  { id: "type", label: "Type" },
  { id: "cover", label: "Cover" },
  { id: "uploads", label: "Uploads" },
  { id: "gallery", label: "Gallery" },
];

export function AppearanceForm({
  event,
  media,
  locked,
  shareLink,
}: {
  event: EventRow;
  media: MediaView[];
  /** Free plan: the whole thing is an upsell rather than a form. */
  locked: boolean;
  /** Drawn into the preview's address bar. */
  shareLink?: string | null;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateAppearance.bind(null, event.id),
    {},
  );

  const custom = (event.theme_custom ?? {}) as Record<string, string>;
  const [themeId, setThemeId] = useState(event.theme ?? "cheese");
  const [fontId, setFontId] = useState(event.theme_font ?? "cheese");
  // Coerced rather than cast: a row can hold a variant that no longer exists -
  // "framed" until its migration lands, or after a restore - and putting that
  // in the form's state means a preview of the wrong shape and a save the
  // server rejects. The host lands on the default instead.
  const [cover, setCover] = useState<CoverVariant>(
    coerceCover(event.cover_variant),
  );
  const [upload, setUpload] = useState<UploadVariant>(
    coerceUpload(event.upload_variant),
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

  // A photo cover with no photo falls back to "Just type" on the guest page, so
  // the host is told rather than left to discover it after the invitations go
  // out. The preview above still shows the shape they picked.
  const coverNeedsPhoto = cover !== "type" && coverMediaId === null;

  if (locked) return <LockedPanel eventId={event.id} />;

  return (
    <section className="card p-5 sm:p-6">
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
        A drawing of what guests see when they scan the code. The photographs
        are left as empty frames, so what you are judging is the page rather
        than the pictures.
      </p>

      {/* --- live preview -------------------------------------------------
          The real components, in a real theme root. A mock-up here is how a
          setting ends up looking dead: the panels below are the same ones the
          guest gets, so a colour that does nothing visible in this box does
          nothing on the page either. */}
      <div className="mt-5">
        <EventPreview
          name={event.name || "Your event"}
          date={event.event_date}
          message={event.welcome_message}
          palette={palette}
          font={font}
          cover={cover}
          upload={upload}
          layout={layout}
          galleryVisible={event.gallery_visible}
          coverChosen={coverMediaId !== null}
          shareLink={shareLink}
          uploadHint={
            getTier(event.tier).video
              ? `Photos and video, up to ${MAX_FILES_PER_PICK} at a time.`
              : `Photos, up to ${MAX_FILES_PER_PICK} at a time.`
          }
        />
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

        <Tabs
          items={LOOK_TABS}
          label="Event page settings"
          idPrefix="look"
          /* Clear of the console's own strip, which is pinned to the top of a
             phone screen: a group opened from the bottom of a long one has to
             land under it, not behind it. */
          stickyOffset={70}
          tablistClassName="-mx-5 px-5 sm:-mx-6 sm:px-6"
        >
          <TabPanel id="theme" className="mt-5 space-y-6">
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
          </TabPanel>

          <TabPanel id="type" className="mt-5 space-y-6">
            <Group label="Type" hint="Pairs a heading face with a body face.">
              <div className="grid gap-2 xs:grid-cols-2">
                {FONT_SETS.map((set) => (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => setFontId(set.id)}
                    aria-pressed={fontId === set.id}
                    className={cx(
                      "rounded-xl border-2 border-pepper p-3.5 text-left",
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
          </TabPanel>

          <TabPanel id="cover" className="mt-5 space-y-6">
            <Group label="Cover style">
              <div className="grid gap-2 xs:grid-cols-2">
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
                      "h-16 w-16 rounded-lg border-2 border-pepper font-mono text-[0.6875rem] uppercase sm:h-14 sm:w-14",
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
                        "h-16 w-16 overflow-hidden rounded-lg border-2 border-pepper sm:h-14 sm:w-14",
                        coverMediaId === item.id &&
                          "ring-4 ring-pepper ring-offset-2 ring-offset-cream",
                      )}
                    >
                      {item.previewUrl && (
                        // A 64px swatch off a 2560px photo. Without the resize
                        // this picker pulls the whole gallery at full size.
                        <Image
                          src={item.previewUrl}
                          alt=""
                          width={128}
                          height={128}
                          sizes="128px"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </Group>
          </TabPanel>

          <TabPanel id="uploads" className="mt-5 space-y-6">
            <Group label="Asking for photos">
              <div className="grid gap-2 xs:grid-cols-2">
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
          </TabPanel>

          <TabPanel id="gallery" className="mt-5 space-y-6">
            <Group label="Gallery layout">
              <div className="grid gap-2 xs:grid-cols-2">
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
          </TabPanel>
        </Tabs>

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
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
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
        "min-h-16 flex-1 rounded-xl border-2 border-pepper px-2.5 py-2 text-left transition-transform xs:flex-none",
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
        "rounded-xl border-2 border-pepper p-3.5 text-left",
        selected ? "bg-gouda" : "bg-butter",
      )}
    >
      <span className="block font-bold leading-snug">{name}</span>
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

  // Event pages are light. A dark pick is lifted rather than refused, and the
  // host is told which colour their guests will actually get - a picker that
  // silently disagrees with the page is worse than one that says no.
  const lifted = lightBackground(colors.bg.toUpperCase());
  const bgWasLifted = lifted !== colors.bg.toUpperCase();

  const fields: Array<[keyof CustomColours, string]> = [
    ["bg", "Background"],
    ["surface", "Cards"],
    ["accent", "Accent"],
    ["ink", "Text"],
  ];

  return (
    <div className="rounded-xl border-2 border-dashed border-rind p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fields.map(([key, label]) => (
          <label key={key} className="block">
            <span className="block text-[0.8125rem] font-semibold">{label}</span>
            <span className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={colors[key]}
                onChange={(e) => onChange({ ...colors, [key]: e.target.value })}
                className="h-10 w-10 shrink-0 cursor-pointer rounded border-2 border-pepper bg-transparent p-0"
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

      {bgWasLifted && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[0.8125rem]">
          <span
            className="h-5 w-5 shrink-0 rounded-full border-2 border-pepper"
            style={{ background: lifted }}
          />
          <span className="text-crust">
            Event pages are always light, so guests get{" "}
            <span className="font-mono uppercase">{lifted}</span> as the
            background - the palest version of the colour you picked.
          </span>
        </p>
      )}
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
          "Six themes, or pick your own colours",
          "Five type pairings, from formal to loud",
          "Four cover styles, including a full-screen photo",
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
