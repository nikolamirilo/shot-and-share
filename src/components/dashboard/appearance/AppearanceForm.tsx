"use client";

import { useEffect, useState } from "react";

import { CoverPicker } from "@/components/dashboard/appearance/CoverPicker";
import { CustomColourPicker } from "@/components/dashboard/appearance/CustomColourPicker";
import { LockedPanel } from "@/components/dashboard/appearance/LockedPanel";
import { PositionPicker } from "@/components/dashboard/appearance/PositionPicker";
import {
  Choice,
  Group,
  OPTION_CARD,
  OPTION_GRID,
  OPTION_SELECTED,
  SWATCH_GRID,
  Swatch,
} from "@/components/dashboard/appearance/OptionCard";
import { SaveBar } from "@/components/dashboard/appearance/SaveBar";
import { useAppearanceDraft } from "@/hooks/appearance/useAppearanceDraft";
import { EventPreview } from "@/components/event/EventPreview";
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
import { cx } from "@/utils/cx";
import { type EventRow } from "@/types/db";
import { type MediaView } from "@/types/media";
import { FONT_SETS, findFontSet, googleFontsHref } from "@/lib/fonts";
import { GALLERY_LAYOUTS } from "@/constants/gallery";
import { uploadWording } from "@/lib/media";
import { getTier } from "@/lib/tiers";

const LOOK_TABS: TabItem[] = [
  { id: "theme", label: "Colour" },
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
  media: MediaView[];
  covers: MediaView[];
  photoCount: number;
  maxFileBytes: number;
  remainingBytes: number;
  locked: boolean;
}) {
  const { settings, update, changes, save, state } = useAppearanceDraft(event);
  const [picked, setPicked] = useState<MediaView | null>(null);

  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setSaved(state.status === "saved");
  }, [state.status]);

  const palette =
    settings.theme === CUSTOM_THEME_ID
      ? buildCustomPalette(settings.colors)
      : findTheme(settings.theme).palette;

  const font = findFontSet(settings.font);

  const coverNeedsPhoto =
    settings.cover !== "type" && settings.coverMediaId === null;

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

      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_23rem] xl:gap-8">
        <div className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
          <EventPreview
            name={event.name || "Your event"}
            message={event.welcome_message}
            palette={palette}
            font={font}
            cover={settings.cover}
            coverPosition={settings.coverPosition}
            upload={settings.upload}
            layout={settings.layout}
            galleryVisible={event.gallery_visible}
            coverChosen={settings.coverMediaId !== null}
            coverUrl={coverUrl}
            wording={uploadWording(getTier(event.tier))}
          />
        </div>

        <div className="mt-6 min-w-0 space-y-6 @container lg:col-start-1 lg:row-start-1 lg:mt-0">
          <Tabs
            items={LOOK_TABS}
            label="Event page settings"
            idPrefix="look"
            variant="segmented"
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
                        className={cx(
                          "mt-1.5 block text-[0.8125rem] leading-snug",
                          settings.font === set.id ? "text-chalk/75" : "text-ash",
                        )}
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

              {settings.cover !== "type" && (
                <Group
                  label="Name position"
                  hint="Where the name, date and message sit on the photo. Pick how far down it goes and which way it is aligned."
                >
                  <PositionPicker
                    value={settings.coverPosition}
                    onChange={(coverPosition) => update({ coverPosition })}
                  />
                </Group>
              )}

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

      <SaveBar changes={changes} state={state} onSave={save} />

      <Toast open={saved} onClose={() => setSaved(false)}>
        Saved. Guests see this now.
      </Toast>
    </Card>
  );
}
