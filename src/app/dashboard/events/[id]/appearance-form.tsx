"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { updateAppearance } from "@/app/dashboard/actions";
import { EventPreview } from "@/components/event-preview";
import { TabPanel, Tabs, type TabItem } from "@/components/tabs";
import { Badge, ButtonLink, cx } from "@/components/ui";
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
 * Every choice is judged against a drawing of the whole guest page - cover,
 * ask, gallery - because the only useful answer to "what does Midnight look
 * like?" is a page, and a swatch of a page cannot give it. See EventPreview: it
 * is the real components inside the real EventThemeRoot, with the photographs
 * left as empty frames.
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
 * the thing it changes. The groups are tabs, so every choice is one tap from
 * the drawing it changes.
 *
 * On a laptop they sit side by side: the controls down the left, the drawing
 * pinned to the right where it stays in view for every one of them. Stacked,
 * as it was, the preview scrolled off the top the moment the host started
 * choosing, which is the one moment it is for. The drawing is a third of the
 * width it used to be, which is roughly a phone - the thing a guest holds.
 */
const LOOK_TABS: TabItem[] = [
  { id: "theme", label: "Colour" },
  { id: "type", label: "Type" },
  { id: "cover", label: "Cover" },
  { id: "uploads", label: "Uploads" },
  { id: "gallery", label: "Gallery" },
];

/**
 * How long a change sits before it is written.
 *
 * Long enough that dragging a colour picker is one write rather than sixty,
 * short enough that a host who picks a theme and looks away has already saved.
 */
const SAVE_DELAY = 700;

interface SaveState {
  status: "clean" | "saving" | "saved";
  error?: string;
}

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

  const save = useAutoSave(event.id, {
    theme: themeId,
    theme_font: fontId,
    cover_variant: cover,
    upload_variant: upload,
    gallery_layout: layout,
    cover_media_id: coverMediaId ?? "",
    custom_bg: colors.bg,
    custom_surface: colors.surface,
    custom_accent: colors.accent,
    custom_ink: colors.ink,
  });

  const palette =
    themeId === CUSTOM_THEME_ID
      ? buildCustomPalette(colors)
      : findTheme(themeId).palette;

  const font = findFontSet(fontId);

  // A photo cover with no photo falls back to "Just type" on the guest page, so
  // the host is told rather than left to discover it after the invitations go
  // out. The drawing still shows the shape they picked.
  const coverNeedsPhoto = cover !== "type" && coverMediaId === null;

  // The cover is the one photograph the drawing carries, because the four cover
  // styles are four crops of it and nobody can choose between crops of a grey
  // rectangle. Null while the picker is on "none" - and also for a cover chosen
  // long enough ago to have fallen off the end of the 120 photos loaded here,
  // where the marked frame is the honest thing to draw.
  const coverUrl =
    media.find((item) => item.id === coverMediaId)?.previewUrl ?? null;

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
        A drawing of what guests see when they scan the code. Your cover photo
        is real; the gallery is left as empty frames, so what you are judging
        there is the shape of the page rather than the pictures.
      </p>

      {/* Two columns on a laptop, one on a phone. There is no form element and
          no submit: every control writes itself (see useAutoSave), so what
          would have been a form is just the layout. */}
      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_23rem] xl:gap-8">
        {/* --- live preview -------------------------------------------------
            The real components, in a real theme root. A mock-up here is how a
            setting ends up looking dead: the panels beside it are the same ones
            the guest gets, so a colour that does nothing visible in this box
            does nothing on the page either.

            First in the source, so a phone still meets the drawing before the
            controls; put in the second column by hand, so a laptop reads
            controls-then-drawing without the markup having to. Pinned at the
            same height as the console's own rail, because the whole point of
            the split is that it is still there at the last group. */}
        <div className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
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
            coverUrl={coverUrl}
            uploadHint={
              getTier(event.tier).video
                ? `Photos and video, up to ${MAX_FILES_PER_PICK} at a time.`
                : `Photos, up to ${MAX_FILES_PER_PICK} at a time.`
            }
          />

          {/* Under the drawing, which is the thing that just changed, and
              pinned with it: with no button to press, this line is the only
              answer to "did that stick?". */}
          <SaveNote save={save} />
        </div>

        {/* A container rather than the viewport decides how the option grids
            below break, because this column is a third of the screen on a
            laptop: `xs:grid-cols-2` there is two columns of squeezed cards on
            a wide screen, which is the opposite of what it was written for. */}
        <div className="mt-6 min-w-0 space-y-6 @container lg:col-start-1 lg:row-start-1 lg:mt-0">
          <Tabs
            items={LOOK_TABS}
            label="Event page settings"
            idPrefix="look"
            variant="segmented"
            /* Clear of the console's own strip, which is pinned to the top of a
               phone screen: a group opened from the bottom of a long one has to
               land under it, not behind it. */
            stickyOffset={70}
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
                <div className="grid gap-2 @min-[26rem]:grid-cols-2">
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
                <div className="grid gap-2 @min-[26rem]:grid-cols-2">
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
                <div className="grid gap-2 @min-[26rem]:grid-cols-2">
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
              <Group
                label="Gallery layout"
                hint="How every guest sees the shared gallery. It is your choice, not theirs - there is no switcher on the event page."
              >
                <div className="grid gap-2 @min-[26rem]:grid-cols-2">
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
        </div>
      </div>
    </section>
  );
}

/**
 * Writes every change, by itself, shortly after it is made.
 *
 * There was a "Save the page" button under the options. Behind tabs it was
 * under whichever group happened to be open, which reads as saving that group,
 * and a host who set a colour, opened Cover and left never saved anything at
 * all. Nothing here is a form any more: the controls are the save.
 *
 * `fields` is the whole payload rather than a diff, because the action writes
 * the whole row - and comparing its JSON against what the database last took is
 * both the change detector and the guard against a save on first paint. A row
 * whose stored variant no longer exists is coerced on the way into state (see
 * the caller) and is deliberately *not* written back for it: rewriting rows
 * because someone looked at a page is not saving, it is drift.
 */
function useAutoSave(eventId: string, fields: Record<string, string>) {
  const [save, setSave] = useState<SaveState>({ status: "clean" });

  const wanted = JSON.stringify(fields);
  // What the database is known to hold. Seeded with the first render, so
  // arriving on the page is never a change.
  const stored = useRef(wanted);
  // Which attempt is the current one. A slower earlier write must not be the
  // thing that decides what is on screen, or what `stored` believes.
  const attempt = useRef(0);

  useEffect(() => {
    if (wanted === stored.current) return;

    const mine = ++attempt.current;
    setSave({ status: "saving" });

    const timer = setTimeout(async () => {
      const body = new FormData();
      for (const [key, value] of Object.entries(
        JSON.parse(wanted) as Record<string, string>,
      )) {
        body.set(key, value);
      }

      // A rejected action is a lost tunnel or a signed-out session, and with
      // no button in front of the host the failure has to say so itself -
      // otherwise "Saving…" sits there forever and they close the tab
      // believing their page changed.
      const result = await updateAppearance(eventId, {}, body).catch(() => ({
        error: "That did not save. Check your connection and try again.",
      }));
      if (attempt.current !== mine) return;

      if (result.error) {
        setSave({ status: "clean", error: result.error });
        return;
      }
      stored.current = wanted;
      setSave({ status: "saved" });
    }, SAVE_DELAY);

    return () => clearTimeout(timer);
  }, [wanted, eventId]);

  return save;
}

/**
 * The whole of the feedback, which is one line.
 *
 * Polite rather than assertive: it changes on every click, and a screen reader
 * that interrupts the name of the theme you just picked to say "saving" is
 * worse than one that waits.
 */
function SaveNote({ save }: { save: SaveState }) {
  if (save.error) {
    return (
      <p className="mt-3 rounded-xl border-2 border-pepper bg-butter p-3 text-[0.9375rem] font-semibold">
        {save.error}
      </p>
    );
  }

  return (
    <p
      aria-live="polite"
      className="mt-3 flex items-center gap-2 text-[0.8125rem] text-crust"
    >
      <span
        aria-hidden
        className={cx(
          "h-2.5 w-2.5 shrink-0 rounded-full border-2 border-pepper",
          save.status === "saved" ? "bg-gouda" : "bg-transparent",
        )}
      />
      {save.status === "saving"
        ? "Saving…"
        : save.status === "saved"
          ? "Saved. Guests see this now."
          : "Every change saves itself."}
    </p>
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
      <div className="grid grid-cols-2 gap-3 @min-[30rem]:grid-cols-4">
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
