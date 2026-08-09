"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { deleteMedia, updateAppearance } from "@/app/dashboard/actions";
import { EventPreview } from "@/components/event-preview";
import { TabPanel, Tabs, type TabItem } from "@/components/tabs";
import { Badge, Button, ButtonLink, ProgressBar, cx } from "@/components/ui";
import {
  COVER_VARIANTS,
  CUSTOM_THEME_ID,
  type CoverVariant,
  DEFAULT_THEME_ID,
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
import { compressImage } from "@/lib/client/codec";
import {
  UploadError,
  postJson,
  uploadToPresigned,
  withRetry,
} from "@/lib/client/upload";
import type { EventRow } from "@/lib/db/types";
import type { MediaView } from "@/lib/events";
import { formatBytes, pluralise } from "@/lib/format";
import {
  DEFAULT_FONT_ID,
  FONT_SETS,
  coerceFont,
  findFontSet,
  googleFontsHref,
} from "@/lib/fonts";
import {
  GALLERY_LAYOUTS,
  type GalleryLayout,
  coerceLayout,
} from "@/lib/gallery";
import {
  ACCEPT_ATTRIBUTE_PHOTO,
  COVER_PAGE_SIZE,
  MAX_FILES_PER_PICK,
} from "@/lib/media";
import type { PresignedUpload } from "@/lib/storage/types";
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
  // The id stays `type`: it is the panel's DOM id, so a link to `#look-type`
  // written before the label changed still opens the right group.
  { id: "type", label: "Font" },
  { id: "cover", label: "Cover" },
  { id: "uploads", label: "Uploads" },
  { id: "gallery", label: "Gallery" },
];

/**
 * One size for every option in this panel.
 *
 * The groups used to size themselves: theme swatches were short and flowed to
 * fill a row, the rest were taller and came two to a row. Tabbing between them
 * moved the controls under the cursor and resized the panel, which reads as the
 * page changing rather than the group. One grid, one floor on the height, and
 * the only thing that changes between tabs is what the cards say.
 */
const OPTION_GRID = "grid gap-2.5 @min-[26rem]:grid-cols-2";
// Unselected tiles rest on the panel; the chosen one comes up off it. That
// height difference is the whole selected state now that nothing is outlined,
// so the two shadows are deliberately far apart rather than one step.
const OPTION_CARD =
  "flex min-h-24 flex-col justify-center rounded-xl p-3.5 text-left transition-shadow";
const OPTION_SELECTED = "bg-gouda shadow-lg";

/** Where a host's unsaved edits wait while the tab is closed. */
const DRAFT_PREFIX = "sayCheese:appearance:";

interface CustomColours {
  bg: string;
  surface: string;
  accent: string;
  ink: string;
}

const DEFAULT_COLOURS: CustomColours = {
  bg: "#FFF6DC",
  surface: "#FFFDF4",
  accent: "#FFC02E",
  ink: "#1F1607",
};

/** Everything on this panel a host can change, in one object. */
interface Settings {
  theme: string;
  font: string;
  cover: CoverVariant;
  upload: UploadVariant;
  layout: GalleryLayout;
  coverMediaId: string | null;
  colors: CustomColours;
}

interface SaveState {
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
function fromEvent(event: EventRow): Settings {
  const custom = (event.theme_custom ?? {}) as Record<string, string>;
  return {
    theme: event.theme ?? DEFAULT_THEME_ID,
    font: event.theme_font ?? DEFAULT_FONT_ID,
    cover: coerceCover(event.cover_variant),
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
function toFields(s: Settings): Record<string, string> {
  return {
    theme: s.theme,
    theme_font: s.font,
    cover_variant: s.cover,
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
function countChanges(a: Settings, b: Settings): number {
  let n = 0;
  if (a.theme !== b.theme) n += 1;
  if (a.font !== b.font) n += 1;
  if (a.cover !== b.cover) n += 1;
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

function readDraft(key: string): Settings | null {
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

function writeDraft(key: string, settings: Settings, saved: Settings) {
  try {
    if (countChanges(settings, saved) === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(settings));
  } catch {
    // Private mode. The edits still work; they just do not survive the tab.
  }
}

export function AppearanceForm({
  event,
  media,
  covers,
  photoCount,
  maxFileBytes,
  remainingBytes,
  locked,
}: {
  event: EventRow;
  /** The newest guest photographs, already loaded by the console. */
  media: MediaView[];
  /** Cover images this host uploaded, newest first. */
  covers: MediaView[];
  /** Every guest photograph at the event, not only the loaded ones. */
  photoCount: number;
  maxFileBytes: number;
  remainingBytes: number;
  /** Free plan: the whole thing is an upsell rather than a form. */
  locked: boolean;
}) {
  const { settings, update, changes, save, state } = useDraft(event);
  /**
   * The photo behind the current selection.
   *
   * The picker pages beyond what this component was handed, so a cover chosen
   * on the fourth page is an id nothing here can resolve. The picker passes the
   * whole item up rather than only its id, and it is trusted only while it
   * still matches what is selected - a stale one after "none" would leave the
   * drawing showing a photograph the host has just removed.
   */
  const [picked, setPicked] = useState<MediaView | null>(null);

  const palette =
    settings.theme === CUSTOM_THEME_ID
      ? buildCustomPalette(settings.colors)
      : findTheme(settings.theme).palette;

  const font = findFontSet(settings.font);

  // A photo cover with no photo falls back to "Just type" on the guest page, so
  // the host is told rather than left to discover it after the invitations go
  // out. The drawing still shows the shape they picked.
  const coverNeedsPhoto =
    settings.cover !== "type" && settings.coverMediaId === null;

  // The cover is the one photograph the drawing carries, because the four cover
  // styles are four crops of it and nobody can choose between crops of a grey
  // rectangle. Null while the picker is on "none" - and also for a cover saved
  // in a draft whose photograph is not among the ones loaded here, where the
  // marked frame is the honest thing to draw.
  const coverUrl =
    (picked?.id === settings.coverMediaId ? picked.previewUrl : null) ??
    [...covers, ...media].find((item) => item.id === settings.coverMediaId)
      ?.previewUrl ??
    null;

  function chooseCover(item: MediaView | null) {
    setPicked(item);
    update({ coverMediaId: item?.id ?? null });
  }

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

      {/* The heading and the save share a line. The count beside the button is
          the whole answer to "did that stick?", so it has to be reachable from
          whichever group is open rather than parked at the bottom of one of
          them - which is where a save button under the tabs would read as
          saving that group and nothing else. */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-h3">The event page</h2>
          <p className="mt-2 max-w-prose text-[0.9375rem] text-crust">
            A drawing of what guests see when they scan the code. Your cover
            photo is real; the gallery is left as empty frames, so what you are
            judging there is the shape of the page rather than the pictures.
          </p>
        </div>

        <SaveBar changes={changes} state={state} onSave={save} />
      </div>

      {state.error && (
        <p className="note mt-3 p-3 text-small font-semibold">
          {state.error} Nothing you picked has been lost.
        </p>
      )}

      {/* Two columns on a laptop, one on a phone. There is no form element:
          the save is the button above rather than a submit down here, so what
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
            cover={settings.cover}
            upload={settings.upload}
            layout={settings.layout}
            galleryVisible={event.gallery_visible}
            coverChosen={settings.coverMediaId !== null}
            coverUrl={coverUrl}
            uploadHint={
              getTier(event.tier).video
                ? `Photos and video, up to ${MAX_FILES_PER_PICK} at a time.`
                : `Photos, up to ${MAX_FILES_PER_PICK} at a time.`
            }
          />
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
                <div className={OPTION_GRID}>
                  {THEMES.map((theme) => (
                    <Swatch
                      key={theme.id}
                      selected={settings.theme === theme.id}
                      onClick={() => update({ theme: theme.id })}
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
                    selected={settings.theme === CUSTOM_THEME_ID}
                    onClick={() => update({ theme: CUSTOM_THEME_ID })}
                    title="Pick your own colours"
                    name="Custom"
                    colors={[
                      settings.colors.bg,
                      settings.colors.accent,
                      settings.colors.ink,
                    ]}
                  />
                </div>
              </Group>

              {settings.theme === CUSTOM_THEME_ID && (
                <CustomColourPicker
                  colors={settings.colors}
                  onChange={(colors) => update({ colors })}
                />
              )}
            </TabPanel>

            <TabPanel id="type" className="mt-5 space-y-6">
              <Group label="Font" hint="Pairs a heading face with a body face.">
                <div className={OPTION_GRID}>
                  {FONT_SETS.map((set) => (
                    <button
                      key={set.id}
                      type="button"
                      onClick={() => update({ font: set.id })}
                      aria-pressed={settings.font === set.id}
                      className={cx(
                        OPTION_CARD,
                        settings.font === set.id ? OPTION_SELECTED : "bg-butter shadow-sm",
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
                <div className={OPTION_GRID}>
                  {COVER_VARIANTS.map((option) => (
                    <Choice
                      key={option.id}
                      selected={settings.cover === option.id}
                      onClick={() => update({ cover: option.id })}
                      name={option.name}
                      hint={option.hint}
                    />
                  ))}
                </div>
              </Group>

              <Group
                label="Cover photo"
                hint="Pick any photo from the event, or upload one of your own."
              >
                {coverNeedsPhoto && (
                  <p className="inset-shadow-well mb-2.5 rounded-xl bg-rind/8 p-3 text-label leading-snug text-crust">
                    No cover photo yet. Until you pick one, guests get the{" "}
                    <strong>Just type</strong> cover rather than the one above.
                  </p>
                )}

                <CoverPicker
                  eventId={event.id}
                  photos={media}
                  photoCount={photoCount}
                  covers={covers}
                  selectedId={settings.coverMediaId}
                  selectedUrl={coverUrl}
                  onSelect={chooseCover}
                  maxFileBytes={maxFileBytes}
                  remainingBytes={remainingBytes}
                />
              </Group>
            </TabPanel>

            <TabPanel id="uploads" className="mt-5 space-y-6">
              <Group label="Asking for photos">
                <div className={OPTION_GRID}>
                  {UPLOAD_VARIANTS.map((option) => (
                    <Choice
                      key={option.id}
                      selected={settings.upload === option.id}
                      onClick={() => update({ upload: option.id })}
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
                <div className={OPTION_GRID}>
                  {GALLERY_LAYOUTS.map((option) => (
                    <Choice
                      key={option.id}
                      selected={settings.layout === option.id}
                      onClick={() => update({ layout: option.id })}
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
 * The edits, the count of them, and the one write that clears it.
 *
 * This panel used to write every change by itself, a beat after it was made.
 * Six groups behind tabs is a lot of page to be saving silently: a host had no
 * way to tell a colour they had settled on from one they were still trying,
 * and no way to back out of either. Nothing reaches the database now until the
 * button is pressed, and the number beside it says how much is waiting.
 *
 * What a button costs is that a closed tab would lose the work, so the pending
 * edits live in local storage under the event's own key and are read back on
 * the way in. A successful save is the only thing that clears them: until then
 * the draft is what the host sees, and the row is only the baseline it is
 * measured against.
 */
function useDraft(event: EventRow) {
  const initial = fromEvent(event);
  const [settings, setSettings] = useState(initial);
  // What the database is known to hold. Only a save moves it.
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  // Local storage cannot be read while rendering on the server, so the first
  // paint is the row and the draft lands immediately after it.
  const [ready, setReady] = useState(false);

  const key = DRAFT_PREFIX + event.id;
  const changes = countChanges(settings, saved);

  useEffect(() => {
    const draft = readDraft(key);
    if (draft) setSettings(draft);
    setReady(true);
  }, [key]);

  // `ready` is a piece of state rather than a ref because it is set in the
  // same batch as the restored draft above: the first run of this effect
  // already has that draft in hand. A ref would let this run once beforehand
  // and write the row back over a draft nothing had read yet.
  useEffect(() => {
    if (!ready) return;
    writeDraft(key, settings, saved);
  }, [ready, key, settings, saved]);

  function update(patch: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
    // A fresh edit clears both "Saved" and the last attempt's error: neither
    // is true of what is on the screen any more.
    setState({ status: "idle" });
  }

  async function save() {
    const sent = settings;
    setState({ status: "saving" });

    const body = new FormData();
    for (const [name, value] of Object.entries(toFields(sent))) {
      body.set(name, value);
    }

    // A rejected action is a lost tunnel or a signed-out session. The draft is
    // left exactly as it is, so the host presses the button again rather than
    // rebuilding their page from memory.
    const result = await updateAppearance(event.id, {}, body).catch(() => ({
      error: "That did not save. Check your connection and try again.",
    }));

    if (result.error) {
      setState({ status: "idle", error: result.error });
      return;
    }

    // What was sent, not what is on screen: a host who kept clicking while the
    // write was in flight still has those later clicks counted as waiting.
    setSaved(sent);
    setState({ status: "saved" });
  }

  return { settings, update, changes, save, state };
}

/**
 * The count and the button.
 *
 * Polite rather than assertive: a screen reader that interrupts the name of
 * the theme you just picked to say "2 changes" is worse than one that waits.
 */
function SaveBar({
  changes,
  state,
  onSave,
}: {
  changes: number;
  state: SaveState;
  onSave: () => void;
}) {
  const saving = state.status === "saving";

  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <span aria-live="polite" className="flex items-center">
        {changes > 0 ? (
          <Badge tone="gouda">{pluralise(changes, "change")}</Badge>
        ) : (
          <span className="text-[0.8125rem] text-crust">
            {state.status === "saved"
              ? "Saved. Guests see this now."
              : "No changes"}
          </span>
        )}
      </span>

      <Button
        type="button"
        size="sm"
        onClick={onSave}
        disabled={changes === 0 || saving}
      >
        {saving ? "Saving…" : changes === 0 ? "All changes saved" : "Save changes"}
      </Button>
    </div>
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
      className={cx(OPTION_CARD, selected ? OPTION_SELECTED : "bg-butter shadow-sm")}
    >
      {/* Big enough to judge a colour by. At the old size a theme was three
          dots about as wide as the full stop ending this sentence, and the
          only honest way to tell two of them apart was to click both. */}
      <span className="flex gap-1.5">
        {colors.map((c) => (
          <span
            key={c}
            className="inset-shadow-well h-7 w-7 rounded-full shadow-sm"
            style={{ background: c }}
          />
        ))}
      </span>
      <span className="mt-2 block text-[0.8125rem] font-semibold">{name}</span>
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
      className={cx(OPTION_CARD, selected ? OPTION_SELECTED : "bg-butter shadow-sm")}
    >
      <span className="block font-bold leading-snug">{name}</span>
      <span className="mt-0.5 block text-[0.8125rem] leading-snug text-crust">
        {hint}
      </span>
    </button>
  );
}

/**
 * The cover photograph: everything at the event, and anything the host brings.
 *
 * It used to be the first two dozen photos the console happened to have loaded,
 * which meant a host whose cover shot was taken on the second night could not
 * reach it at all - the picture was in the bucket, in the gallery one tab away,
 * and simply not offered here. Everything is reachable now, twenty at a time,
 * on the keyset cursor the guest gallery already uses.
 *
 * The choosing happens in a dialog rather than in the panel. These controls sit
 * in a column about the width of a phone with the drawing pinned beside them,
 * and a hundred thumbnails do not go in there at any size worth looking at: at
 * 56px a host is choosing between grey smudges, and at a size they can actually
 * recognise a face in, four pages of photographs push the preview off the
 * screen - which is the one thing the whole panel is arranged around. The
 * dialog has the window to itself, so the tiles can be big; the panel keeps one
 * of them, which answers the only question it has to answer standing still:
 * which photograph is it at the moment.
 */
function CoverPicker({
  eventId,
  photos: firstPage,
  photoCount,
  covers,
  selectedId,
  selectedUrl,
  onSelect,
  maxFileBytes,
  remainingBytes,
}: {
  eventId: string;
  photos: MediaView[];
  photoCount: number;
  covers: MediaView[];
  selectedId: string | null;
  /** What the drawing is showing, so the tile and the preview cannot disagree. */
  selectedUrl: string | null;
  onSelect: (item: MediaView | null) => void;
  maxFileBytes: number;
  remainingBytes: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // The console already loaded these, so the first page costs no request.
  const [photos, setPhotos] = useState(() =>
    firstPage.slice(0, COVER_PAGE_SIZE),
  );
  const [exhausted, setExhausted] = useState(
    () => firstPage.length < COVER_PAGE_SIZE,
  );
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState(covers);
  const [upload, setUpload] = useState<{ name: string; percent: number } | null>(
    null,
  );
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Both halves have to agree before another page is offered: the count is what
  // the database says exists, and `exhausted` is what the last request actually
  // returned. A photo deleted mid-browse makes the first one optimistic.
  const more = !exhausted && photos.length < photoCount;

  // Escape closes it, like every other overlay in the product. An upload in
  // flight is not interrupted by closing - the bytes are already on their way,
  // and the row is written whether or not anyone is looking.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /** Picking is the whole reason the dialog is open, so it also closes it. */
  function choose(item: MediaView | null) {
    onSelect(item);
    setOpen(false);
  }

  async function loadMore() {
    const last = photos[photos.length - 1];
    if (loading || !last) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/events/${eventId}/cover-photos?before=${encodeURIComponent(last.createdAt)}`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as {
        items: MediaView[];
        nextCursor: string | null;
      };

      // Deduplicated on the way in. The cursor is a timestamp, and two photos
      // uploaded in the same millisecond would otherwise arrive twice and give
      // React two children with the same key.
      setPhotos((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...body.items.filter((item) => !seen.has(item.id))];
      });
      if (!body.nextCursor) setExhausted(true);
    } catch {
      setError("Could not load more photos. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function confirmUpload(mediaId: string, rest: Record<string, unknown>) {
    return postJson<{ confirmed: boolean; item: MediaView | null }>(
      `/api/events/${eventId}/cover/confirm`,
      { mediaId, ...rest },
    );
  }

  /**
   * The host's own image, through the same handshake a guest's photo uses: the
   * browser shrinks it, the server signs a URL, the bytes go straight to the
   * bucket, and the row is written only once they are there.
   */
  async function uploadCover(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("A cover has to be an image rather than a video.");
      return;
    }
    if (file.size > maxFileBytes) {
      setError(
        `That image is bigger than ${formatBytes(maxFileBytes, 0)}, which is the most we can take in one file.`,
      );
      return;
    }

    setUpload({ name: file.name, percent: 0 });
    try {
      const prepared = await compressImage(file);

      const { upload: signed } = await withRetry(() =>
        postJson<{
          upload: {
            mediaId: string;
            source: "file" | "compressed";
            media: PresignedUpload;
          };
        }>(`/api/events/${eventId}/cover/presign`, {
          file: {
            size: file.size,
            type: file.type,
            compressed: prepared.compressed
              ? {
                  size: prepared.compressed.blob.size,
                  format: prepared.compressed.format,
                  width: prepared.compressed.width,
                  height: prepared.compressed.height,
                }
              : null,
            sourceWidth: prepared.sourceWidth,
            sourceHeight: prepared.sourceHeight,
            needsServer: prepared.needsServer,
          },
        }),
      );

      const body =
        signed.source === "compressed" && prepared.compressed
          ? prepared.compressed.blob
          : file;

      try {
        await withRetry(() =>
          uploadToPresigned(signed.media, body, (fraction) =>
            setUpload((prev) =>
              prev ? { ...prev, percent: Math.round(fraction * 100) } : prev,
            ),
          ),
        );
      } catch (e) {
        // Give the reserved space back rather than leaving it on the host's
        // quota until the nightly sweep gets to it.
        await confirmUpload(signed.mediaId, {
          mediaUploaded: false,
          failed: true,
        }).catch(() => {
          /* the sweep is the backstop */
        });
        throw e;
      }

      const result = await withRetry(() =>
        confirmUpload(signed.mediaId, {
          width: prepared.sourceWidth,
          height: prepared.sourceHeight,
          mediaUploaded: true,
        }),
      );

      if (!result.confirmed || !result.item) {
        throw new UploadError("The image went up but could not be saved.");
      }

      const item = result.item;
      setUploads((prev) => [item, ...prev]);
      // Uploading a cover is choosing one, so it lands the same way a tap does
      // and hands the host back to the drawing. It is still only a draft: the
      // row is not touched until Save changes.
      choose(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That image did not upload.");
    } finally {
      setUpload(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeUpload(item: MediaView) {
    setError(null);
    setRemoving(item.id);

    const result = await deleteMedia(eventId, [item.id]).catch(() => ({
      error: "That did not delete. Check your connection and try again.",
    }));

    setRemoving(null);
    if (result.error) {
      setError(result.error);
      return;
    }

    setUploads((prev) => prev.filter((u) => u.id !== item.id));
    if (selectedId === item.id) onSelect(null);
  }

  return (
    <>
      {/* Outside the dialog on purpose. It is what the Upload button clicks,
          and the dialog closes on a successful upload - an input inside it
          would be gone before the handler had finished tidying up after
          itself. */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE_PHOTO}
        id="cover-file"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadCover(file);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-butter shadow-md">
          {selectedUrl ? (
            <Image
              src={selectedUrl}
              alt=""
              width={128}
              height={128}
              sizes="128px"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-mono text-micro uppercase text-rind">
              none
            </span>
          )}
        </span>

        <div className="min-w-0">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setOpen(true)}
          >
            {selectedUrl ? "Change the cover photo" : "Choose a cover photo"}
          </Button>
          <p className="mt-1.5 text-label text-crust">
            {photoCount === 0
              ? "No photos from guests yet - you can upload your own."
              : `${pluralise(photoCount, "photo")} from the event, or upload your own.`}
          </p>
        </div>
      </div>

      {/* The error lives out here too. An upload that failed closes nothing,
          but one that failed after the host had already closed the dialog would
          otherwise report itself to an empty room. */}
      {!open && error && (
        <p className="note mt-3 p-3 text-label font-semibold leading-snug">
          {error}
        </p>
      )}

      {open && (
        <div
          /* Safe-area padding at the bottom: on a phone the home indicator sits
             exactly where the last row of tiles lands. */
          className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-pepper/92 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Choose a cover photo"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-card bg-cream shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative z-10 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 bg-butter p-4 shadow-sm sm:p-5">
              <div className="min-w-0">
                <h3 className="text-h3">Choose a cover photo</h3>
                <p className="mt-1 text-label text-crust">
                  Tap one to use it. {formatBytes(remainingBytes)} of room left.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={Boolean(upload)}
                  onClick={() => inputRef.current?.click()}
                >
                  {upload ? `Uploading… ${upload.percent}%` : "Upload your own"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  autoFocus
                  onClick={() => setOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>

            {(upload || error) && (
              <div className="relative z-10 bg-butter p-4 shadow-sm sm:p-5">
                {upload && (
                  <>
                    <ProgressBar percent={upload.percent} />
                    <p className="mt-1.5 truncate text-label text-crust">
                      {upload.name}
                    </p>
                  </>
                )}
                {error && (
                  <p
                    className={cx(
                      "text-label font-semibold leading-snug",
                      upload && "mt-2.5",
                    )}
                  >
                    {error}
                  </p>
                )}
              </div>
            )}

            {/* The one part that scrolls. `min-h-0` is what lets it: a flex
                child will not shrink below its content without it, and the
                panel would grow past the window instead of the grid gaining a
                scrollbar. */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid grid-cols-3 gap-2.5 xs:grid-cols-4 sm:grid-cols-5">
                <button
                  type="button"
                  onClick={() => choose(null)}
                  aria-pressed={selectedId === null}
                  className={cx(
                    TILE,
                    "flex items-center justify-center font-mono text-micro uppercase",
                    selectedId === null ? "bg-gouda" : "bg-butter",
                    selectedId === null && TILE_SELECTED,
                  )}
                >
                  none
                  {selectedId === null && <Chosen />}
                </button>

                {/* The host's own, first and marked. The cross is a sibling
                    rather than a child of the tile: a button inside a button is
                    not markup a browser agrees to render. */}
                {uploads.map((item) => (
                  <div key={item.id} className="relative">
                    <CoverThumb
                      item={item}
                      selected={selectedId === item.id}
                      onClick={() => choose(item)}
                    />
                    <button
                      type="button"
                      title="Delete this cover image"
                      aria-label="Delete this cover image"
                      disabled={removing === item.id}
                      onClick={() => void removeUpload(item)}
                      className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-cream text-label font-bold leading-none shadow-md disabled:opacity-45"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {photos.map((item) => (
                  <CoverThumb
                    key={item.id}
                    item={item}
                    selected={selectedId === item.id}
                    onClick={() => choose(item)}
                  />
                ))}
              </div>
            </div>

            <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-butter p-4 shadow-sm sm:p-5">
              <span className="text-label text-crust">
                {photoCount === 0
                  ? "No photos from guests yet."
                  : `Showing ${photos.length} of ${pluralise(photoCount, "photo")} from the event.`}
              </span>
              {more && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => void loadMore()}
                >
                  {loading ? "Loading…" : `Load ${COVER_PAGE_SIZE} more`}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * A square, whatever shape the photograph is.
 *
 * The tiles are a grid rather than a wrapping row so that the columns line up
 * down the dialog: a row of mixed aspect ratios reads as a jumble, and what the
 * host is scanning for is one picture among a hundred.
 */
const TILE =
  "relative aspect-square w-full overflow-hidden rounded-xl bg-butter shadow-sm transition-shadow";
const TILE_SELECTED = "shadow-lg";

/**
 * Which one is chosen.
 *
 * This was a ring, and a ring is a border wearing a different name. A mark
 * printed on the photograph is also the stronger signal of the two: the tiles
 * are a hundred squares of somebody's wedding, and an edge four pixels wide is
 * easy to lose among them in a way that a Gouda disc is not.
 */
function Chosen() {
  return (
    <span
      aria-hidden="true"
      className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-gouda text-pepper shadow-md"
    >
      <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none">
        <path
          d="M2.5 6.4 4.9 8.8 9.5 3.4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function CoverThumb({
  item,
  selected,
  onClick,
}: {
  item: MediaView;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(TILE, selected && TILE_SELECTED)}
    >
      {item.previewUrl && (
        // Through the optimiser, not a bare <img>. `previewUrl` is the stored
        // photo - a phone camera's several megabytes - and a grid of a hundred
        // of them at full size is the whole gallery pulled down to fill tiles
        // a couple of hundred pixels wide.
        <Image
          src={item.previewUrl}
          alt=""
          width={320}
          height={320}
          sizes="320px"
          className="h-full w-full object-cover"
        />
      )}
      {selected && <Chosen />}
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
function CustomColourPicker({
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
    <div className="inset-shadow-well rounded-xl bg-pepper/5 p-4">
      <div className="grid grid-cols-2 gap-3 @min-[30rem]:grid-cols-4">
        {fields.map(([key, label]) => (
          <label key={key} className="block">
            <span className="block text-[0.8125rem] font-semibold">{label}</span>
            <span className="mt-1.5 flex items-center gap-2">
              <input
                type="color"
                value={colors[key]}
                onChange={(e) =>
                  onChange({ ...colors, [key]: e.target.value.toUpperCase() })
                }
                className="h-12 w-12 shrink-0 cursor-pointer rounded-lg bg-transparent p-0 shadow-md"
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
            className="inset-shadow-well h-5 w-5 shrink-0 rounded-full shadow-sm"
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
