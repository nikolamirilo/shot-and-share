import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EventCover, EventThemeRoot } from "@/components/event/event-cover";
import { EventPreview } from "@/components/event/event-preview";
import { UploadPanel } from "@/components/upload/upload-panel";
import { THEMES, buildCustomPalette } from "@/lib/appearance";
import { findFontSet } from "@/lib/fonts";
import { GALLERY_LAYOUTS, type GalleryLayout } from "@/lib/gallery";
import { uploadWording } from "@/lib/media";
import { TIERS } from "@/lib/tiers";

/**
 * The host's preview, which is the one screen where a setting can look broken
 * without anything actually being broken. Both bugs these tests pin down came
 * from the preview drawing its own approximation of the guest page instead of
 * rendering it.
 */

const palette = THEMES[0].palette;

describe("the cover a host is shown", () => {
  it("shows the variant that was picked before a photo exists", () => {
    // Every photo variant used to collapse into "Just type" here, so all four
    // buttons produced the same picture and the choice looked dead.
    for (const variant of ["full", "classic", "half"] as const) {
      const html = renderToStaticMarkup(
        <EventCover
          variant={variant}
          name="Your event"
          date="2026-09-12"
          coverUrl={null}
          palette={palette}
          preview
        />,
      );
      expect(html).toContain("your photo");
    }
  });

  it("still falls back to type on the guest page itself", () => {
    // An empty frame at the top of a wedding page is worse than no photo, so
    // the fallback stays everywhere except the preview.
    const html = renderToStaticMarkup(
      <EventCover
        variant="classic"
        name="Your event"
        date="2026-09-12"
        coverUrl={null}
        palette={palette}
      />,
    );
    expect(html).not.toContain("your photo");
  });

  it("lets the full-screen cover take the room the header left it", () => {
    // "Full screen" has to mean the screen. The guest page stacks the header
    // and this cover in one screen-high column; a cover that only knows how to
    // be 100svh tall is a screen *plus* a header, and what falls off the bottom
    // is the name and the scroll cue - the two reasons the variant exists.
    const html = renderToStaticMarkup(
      <EventCover
        variant="full"
        name="Your event"
        date="2026-09-12"
        coverUrl="https://example.test/thumb.jpg"
        palette={palette}
      />,
    );
    expect(html).toContain("flex-1");
    // Still correct standing on its own, where flex-1 does nothing.
    expect(html).toContain("h-svh");
  });
});

describe("the colours a host is shown", () => {
  it("carries the type pairing down to everything underneath", () => {
    const html = renderToStaticMarkup(
      <EventThemeRoot palette={palette} font={findFontSet("classic")}>
        <p>anything</p>
      </EventThemeRoot>,
    );
    expect(html).toContain("Playfair Display");
    expect(html).toContain("--font-display-weight:700");
  });
});

describe("the upload panel", () => {
  it("keeps the same two parts in every variant", () => {
    // Shape is the only thing a host is choosing here. The action and the line
    // saying what may be sent and how much room is left survive all four.
    for (const variant of ["button", "panel", "bar", "split"] as const) {
      const guest = renderToStaticMarkup(
        <UploadPanel
          variant={variant}
          label="Add your photos"
          hint="Photos, up to 20 at a time."
        />,
      );
      expect(guest).toContain("Photos, up to 20 at a time.");
      // Not the label itself: the split variant names its two halves instead,
      // which is the one difference the markup is allowed to have.
      expect(guest).toContain("<button");

      const preview = renderToStaticMarkup(
        <UploadPanel
          variant={variant}
          label="Add your photos"
          hint="Photos, up to 20 at a time."
          preview
        />,
      );
      expect(preview).toContain("Photos, up to 20 at a time.");
    }
  });
});

/**
 * The drawing of the whole page. It replaced a cover, a panel and four squares
 * in a row, which said the same thing about all four gallery layouts and left
 * the host to imagine the rest of the page around it.
 */
function preview(props: Partial<Parameters<typeof EventPreview>[0]> = {}) {
  return renderToStaticMarkup(
    <EventPreview
      name="Ana and Marko"
      date="2026-09-12"
      palette={palette}
      font={findFontSet("cheese")}
      cover="classic"
      coverPosition="bottom-left"
      upload="button"
      layout="grid"
      wording={uploadWording(TIERS.free)}
      galleryVisible
      coverChosen
      {...props}
    />,
  );
}

describe("the drawing of the guest page", () => {
  it("draws the page a guest actually lands on", () => {
    // Each of these is a part of the guest page that the old preview left out,
    // and every one of them carries a colour the host is choosing.
    const html = preview({ message: "Send us the ones you took." });

    expect(html).toContain("Ana and Marko");
    expect(html).toContain("Send us the ones you took.");
    expect(html).toContain("Add your photos");
    expect(html).toContain(uploadWording(TIERS.free).hint);
    expect(html).toContain("Everyone&#x27;s photos");
  });

  /**
   * The preview is the only place a host sees the wording before their guests
   * do, so a plan with video has to be drawn asking for video. It said "Add
   * your photos" on every plan, which is the same copy the guest page itself
   * was showing to people holding a clip they could not send.
   */
  it("asks for video on a plan that takes video", () => {
    const html = preview({ wording: uploadWording(TIERS.pro) });

    expect(html).toContain("Add your photos and video");
    expect(html).toContain("Photos and video");
  });

  it("draws the cover photo the host picked, and only that one", () => {
    // The four cover styles are four crops of one picture. Judging between
    // them against a grey frame is judging nothing, so this photograph - and
    // no other - is real.
    const html = preview({
      cover: "full",
      coverUrl: "https://media.example.com/photo.jpg",
    });

    expect(html).toContain('src="https://media.example.com/photo.jpg"');
    expect(html.match(/<img/g)).toHaveLength(1);
  });

  it("keeps the marked frame until a cover photo exists", () => {
    const html = preview({ cover: "full", coverChosen: false });
    expect(html).not.toContain("<img");
    expect(html).toContain("no photo yet");
  });

  it("gives every gallery layout its own shape", () => {
    // The whole point of the layout buttons. Four identical rows of squares is
    // what this used to draw, whichever one was selected.
    const drawn = new Map<GalleryLayout, string>();
    for (const layout of GALLERY_LAYOUTS) {
      drawn.set(layout.id, preview({ layout: layout.id }));
    }

    expect(new Set(drawn.values()).size).toBe(GALLERY_LAYOUTS.length);
    expect(drawn.get("grid")).toContain("grid-cols-3");
    expect(drawn.get("masonry")).toContain("columns-2");
    // The uneven circle sequence, scaled to the frame rather than re-invented.
    expect(drawn.get("holes")).toContain("hole");
    expect(drawn.get("holes")).toMatch(/width:\d+px/);
    expect(drawn.get("stack")).toContain("aspect-ratio:1.75");
  });

  it("carries the chosen colours across the whole drawing", () => {
    const wheat = buildCustomPalette({
      bg: "#FFF6DC",
      surface: "#F5DEB3",
      accent: "#FFC02E",
      ink: "#1F1607",
    });
    const html = preview({ palette: wheat, upload: "bar" });

    expect(html).toContain("--color-paper:#F5DEB3");
    expect(html).toContain("card");
    // The wells the photos sit in are the theme's dark, not a fixed grey.
    expect(html).toContain("--color-well:");
  });

  it("paints the drawn upload button in the accent colour", () => {
    // The drawing had its own fill - ink - so the one button on the guest page
    // was the one thing on the drawing that ignored the accent the host was
    // picking. Every variant that draws a button takes Button's own fill now.
    for (const upload of ["button", "bar", "split"] as const) {
      const html = preview({ upload });
      expect(html).toContain("bg-claret");
      expect(html).not.toContain("bg-ink");
    }
  });

  it("puts nothing focusable inside the host's form", () => {
    for (const layout of GALLERY_LAYOUTS) {
      const html = preview({ layout: layout.id, upload: "panel" });
      expect(html).not.toContain("<button");
      expect(html).not.toContain("<input");
      expect(html).not.toContain("<a ");
    }
  });
});

/**
 * Where the name sits on the photograph. The wash under it is the reason this
 * has its own block of tests: the type can move and still be unreadable.
 */
describe("the name's position on the cover", () => {
  function cover(props: Partial<Parameters<typeof EventCover>[0]> = {}) {
    return renderToStaticMarkup(
      <EventCover
        variant="full"
        name="Ana and Marko"
        date="2026-09-12"
        coverUrl="https://media.example.com/photo.jpg"
        palette={palette}
        {...props}
      />,
    );
  }

  it("leaves the cover alone when nothing was chosen", () => {
    // Every event that existed before this setting did renders exactly the
    // page it rendered before: type at the foot, under the foot-heavy wash.
    const before = cover();
    expect(before).toBe(cover({ position: "bottom-left" }));
    expect(before).toContain("linear-gradient(to top");
    expect(before).toContain("inset-x-0 bottom-0");
  });

  it("turns the wash over when the name goes to the top", () => {
    // The whole point. White type at the head of a bright photograph under a
    // gradient that is heaviest at the foot is white type on a white sky.
    const html = cover({ position: "top-left" });

    expect(html).toContain("linear-gradient(to bottom");
    expect(html).not.toContain("linear-gradient(to top,");
    expect(html).toContain("inset-x-0 top-0");
  });

  it("puts a scrim under a name in the middle", () => {
    const html = cover({ position: "centre" });

    expect(html).toContain("radial-gradient");
    expect(html).toContain("text-center");
  });

  it("keeps the scroll cue at the foot when the name leaves it", () => {
    // The cue points at what is below the cover, not at the name, so it is
    // pinned to the foot in its own box once the name is no longer down there.
    for (const position of ["centre", "top-left"] as const) {
      const html = cover({ position });
      expect(html).toContain("add your photos");
      expect(html).toContain("absolute inset-x-0 bottom-0");
    }

    // At the foot it still trails the name, in the same box, as it always has.
    const foot = cover({ position: "bottom-left" });
    expect(foot).toContain("add your photos");
    expect(foot).not.toContain("absolute inset-x-0 bottom-0 mx-auto max-w-3xl text-white");

    // The half cover has never carried one: the ask is already on the screen.
    expect(cover({ variant: "half", position: "top-left" })).not.toContain(
      "add your photos",
    );
  });

  it("carries the same choice on the half and banner covers", () => {
    for (const variant of ["half", "classic"] as const) {
      expect(cover({ variant, position: "top-left" })).toContain(
        "linear-gradient(to bottom",
      );
      expect(cover({ variant, position: "bottom-left" })).toContain(
        "linear-gradient(to top",
      );
    }
  });
});
