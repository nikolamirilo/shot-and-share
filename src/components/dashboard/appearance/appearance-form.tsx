"use client";

import { useEffect, useState } from "react";

import { CoverPicker } from "@/components/dashboard/appearance/cover-picker";
import { CustomColourPicker } from "@/components/dashboard/appearance/custom-colour-picker";
import { LockedPanel } from "@/components/dashboard/appearance/locked-panel";
import {
  Choice,
  Group,
  OPTION_CARD,
  OPTION_GRID,
  OPTION_SELECTED,
  SWATCH_GRID,
  Swatch,
} from "@/components/dashboard/appearance/option-card";
import { SaveBar } from "@/components/dashboard/appearance/save-bar";
import { useAppearanceDraft } from "@/components/dashboard/appearance/use-appearance-draft";
import { EventPreview } from "@/components/event/event-preview";
import { Card, Toast } from "@/components/ui";
import { TabPanel, Tabs, type TabItem } from "@/components/ui/tabs";
import {
  COVER_VARIANTS,
  CUSTOM_THEME_ID,
  THEMES,
  UPLOAD_VARIANTS,
  buildCustomPalette,
  findTheme,
} from "@/lib/appearance";
import { cx } from "@/lib/cx";
import type { EventRow } from "@/lib/db/types";
import type { MediaView } from "@/lib/media-view";
import { FONT_SETS, findFontSet, googleFontsHref } from "@/lib/fonts";
import { GALLERY_LAYOUTS } from "@/lib/gallery";
import { MAX_FILES_PER_PICK } from "@/lib/media";
import { getTier } from "@/lib/tiers";

/**
 * The custom event page editor.
 *
 * Every choice is judged against a drawing of the whole guest page, because the
 * only useful answer to "what does Midnight look like?" is a page. The drawing
 * is the real components inside the real EventThemeRoot - see EventPreview -
 * which is a rule rather than a detail: anything hand-drawn stops agreeing with
 * the page it stands for.
 *
 * The groups are tabs, so every choice is one tap from the drawing it changes,
 * and on a laptop the drawing is pinned beside them where it stays in view.
 */
const LOOK_TABS: TabItem[] = [
  { id: "theme", label: "Colour" },
  // The id stays `type`: it is the panel's DOM id, so `#look-type` still
  // opens the right group.
  { id: "type", label: "Font" },
  { id: "cover", label: "Cover" },
  { id: "uploads", label: "Uploads" },
  { id: "gallery", label: "Gallery" },
];

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
  const { settings, update, changes, save, state } = useAppearanceDraft(event);
  /**
   * The photo behind the current selection. The picker pages beyond what this
   * component was handed, so it passes the whole item up rather than its id -
   * trusted only while it still matches what is selected.
   */
  const [picked, setPicked] = useState<MediaView | null>(null);

  /**
   * Whether the save is still worth announcing. State of its own rather than
   * `state.status` read straight through, because the host can dismiss the
   * message while the save it is about is still the last thing that happened -
   * and the next edit takes it away, since "Saved" over unsaved work is a lie.
   */
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setSaved(state.status === "saved");
  }, [state.status]);

  const palette =
    settings.theme === CUSTOM_THEME_ID
      ? buildCustomPalette(settings.colors)
      : findTheme(settings.theme).palette;

  const font = findFontSet(settings.font);

  // A photo cover with no photo falls back to "Just type" on the guest page,
  // so the host is told rather than discovering it after the invitations.
  const coverNeedsPhoto =
    settings.cover !== "type" && settings.coverMediaId === null;

  // The one photograph the drawing carries: the four cover styles are four
  // crops of it. Null on "none", and for a draft whose photograph is not among
  // those loaded here, where the marked frame is the honest thing to draw.
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
    <Card as="section">
      {/* Every pairing, not just the chosen one: a font arriving half a second
          after the click reads as a broken preview. A guest page loads one. */}
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

      <div className="min-w-0">
        <h2 className="text-h3">The event page</h2>
        <p className="mt-2 max-w-prose text-[0.9375rem] text-ash">
          A drawing of what guests see when they scan the code. Your cover photo
          is real; the gallery is left as empty frames, so what you are judging
          there is the shape of the page rather than the pictures.
        </p>
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
        {/* First in the source, so a phone meets the drawing before the
            controls, and placed in the second column by hand so a laptop reads
            controls-then-drawing. Pinned at the console rail's height, because
            the point of the split is that it is still there at the last
            group. */}
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

        {/* An `@container` rather than the viewport decides how the option
            grids break: this column is a third of a laptop screen, so a
            viewport breakpoint would squeeze two columns into it. */}
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
                <div className={SWATCH_GRID}>
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
                  {/* The ten are an even grid; the eleventh is not one of them,
                      so it takes the last row rather than leaving a gap. */}
                  <Swatch
                    className="col-span-2"
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
                        settings.font === set.id ? OPTION_SELECTED : "bg-linen shadow-sm",
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
                        className="mt-1.5 block text-[0.8125rem] leading-snug text-ash"
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
                  <p className="inset-shadow-well mb-2.5 rounded-xl bg-mist/8 p-3 text-label leading-snug text-ash">
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

      {/* Last in the card and sticky against the bottom of the screen, so the
          button is in reach from whichever group is open. It is one save for the
          whole panel, not for the group above it. */}
      <SaveBar changes={changes} state={state} onSave={save} />

      <Toast open={saved} onClose={() => setSaved(false)}>
        Saved. Guests see this now.
      </Toast>
    </Card>
  );
}
