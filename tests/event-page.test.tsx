import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EventCover, EventThemeRoot } from "@/components/event-cover";
import { EventPreview } from "@/components/event-preview";
import { UploadPanel } from "@/components/upload-panel";
import { THEMES, buildCustomPalette } from "@/lib/appearance";
import { findFontSet } from "@/lib/fonts";
import { GALLERY_LAYOUTS, type GalleryLayout } from "@/lib/gallery";

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

  it("lays the name over half a screen of photo", () => {
    // "Half screen" is the full-screen cover at half the height, which is the
    // whole of the difference: the name sits on the photograph rather than in a
    // band under it, and the ask stays on the screen. No scroll cue, because
    // the thing it points at is already visible.
    const html = renderToStaticMarkup(
      <EventCover
        variant="half"
        name="Your event"
        date="2026-09-12"
        coverUrl="https://example.test/thumb.jpg"
        palette={palette}
      />,
    );
    expect(html).toContain("h-[50svh]");
    expect(html).toContain("Your event");
    expect(html).not.toContain("add your photos");
  });

  it("uses the photo once there is one", () => {
    const html = renderToStaticMarkup(
      <EventCover
        variant="half"
        name="Your event"
        date="2026-09-12"
        coverUrl="https://example.test/thumb.jpg"
        palette={palette}
        preview
      />,
    );
    expect(html).toContain("https://example.test/thumb.jpg");
    expect(html).not.toContain("your photo");
  });
});

describe("the colours a host is shown", () => {
  it("paints the chosen card colour in the preview", () => {
    // The old preview drew a near-black bar and four dark recesses, none of
    // which read --color-cream - so picking wheat for "Cards" appeared to do
    // nothing at all.
    const wheat = buildCustomPalette({
      bg: "#FFF6DC",
      surface: "#F5DEB3",
      accent: "#FFC02E",
      ink: "#1F1607",
    });

    const html = renderToStaticMarkup(
      <EventThemeRoot palette={wheat} font={findFontSet("cheese")}>
        <UploadPanel
          variant="button"
          label="Add your photos"
          hint="Photos, up to 20 at a time."
          name=""
          preview
        />
      </EventThemeRoot>,
    );

    expect(html).toContain("--color-cream:#F5DEB3");
    // .card is what turns that variable into a visible surface.
    expect(html).toContain("card");
  });

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
  it("keeps the same three parts in every variant", () => {
    // Shape is the only thing a host is choosing here. What may be sent, how
    // much room is left and the optional name field survive all four - the
    // slim bar labels its name field with a placeholder rather than a heading,
    // which is the one difference the markup is allowed to have.
    for (const variant of ["button", "panel", "bar", "split"] as const) {
      const guest = renderToStaticMarkup(
        <UploadPanel
          variant={variant}
          label="Add your photos"
          hint="Photos, up to 20 at a time."
          name=""
        />,
      );
      expect(guest).toContain("Photos, up to 20 at a time.");
      expect(guest).toContain('id="guest-name"');
      expect(guest).toContain("Your name");

      const preview = renderToStaticMarkup(
        <UploadPanel
          variant={variant}
          label="Add your photos"
          hint="Photos, up to 20 at a time."
          name=""
          preview
        />,
      );
      expect(preview).toContain("Photos, up to 20 at a time.");
    }
  });

  it("puts nothing focusable in the preview", () => {
    // It is a picture of the guest page sitting inside the host's own form.
    // A real button here would be a second "Add your photos" in the tab order
    // and a submit button inside a form that saves.
    const html = renderToStaticMarkup(
      <UploadPanel
        variant="panel"
        label="Add your photos"
        hint="Photos, up to 20 at a time."
        name=""
        preview
      />,
    );
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<input");
  });

  it("is a real control when it is the guest's", () => {
    const html = renderToStaticMarkup(
      <UploadPanel
        variant="panel"
        label="Add your photos"
        hint="Photos, up to 20 at a time."
        name=""
      />,
    );
    expect(html).toContain("<button");
    expect(html).toContain("<input");
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
      upload="button"
      layout="grid"
      uploadHint="Photos, up to 20 at a time."
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
    expect(html).toContain("Photos, up to 20 at a time.");
    expect(html).toContain("Everyone&#x27;s photos");
  });

  it("carries nothing of ours above the cover or below the gallery", () => {
    // The panel is locked on the free plan, so everything this draws is a paid
    // page - and a paid page is the host's, top to bottom. If the mark or the
    // small print came back here it would mean it had come back on the page.
    const html = preview();

    expect(html).not.toContain("Say Cheese");
    expect(html).not.toContain("go to the host of this event");
  });

  it("loads no gallery photograph at all", () => {
    // Every tile is drawn. A host clicking through five themes and four
    // layouts is not worth an image request per tile, and their guests' faces
    // answer none of the questions this panel is asking.
    for (const layout of GALLERY_LAYOUTS) {
      const html = preview({ layout: layout.id });
      expect(html).not.toContain("<img");
      expect(html).not.toContain("background-image");
    }
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

  it("draws no layout switcher, because the page no longer has one", () => {
    // The layout is the host's decision, like the theme and the cover. A row
    // of layout names in the drawing would promise guests a switch they do
    // not get.
    const html = preview({ layout: "grid" });
    for (const option of GALLERY_LAYOUTS) {
      expect(html).not.toContain(option.name);
    }
  });

  it("hides the gallery when the event hides it", () => {
    expect(preview({ galleryVisible: false })).not.toContain(
      "Everyone&#x27;s photos",
    );
  });

  it("says whether a cover photo has been chosen", () => {
    expect(preview({ coverChosen: false })).toContain("no photo yet");
    expect(preview({ coverChosen: true })).toContain("your photo");
  });

  it("carries the chosen colours across the whole drawing", () => {
    const wheat = buildCustomPalette({
      bg: "#FFF6DC",
      surface: "#F5DEB3",
      accent: "#FFC02E",
      ink: "#1F1607",
    });
    const html = preview({ palette: wheat, upload: "bar" });

    expect(html).toContain("--color-cream:#F5DEB3");
    expect(html).toContain("card");
    // The recesses the photos sit in are the theme's void, not a fixed grey.
    expect(html).toContain("--color-hole:");
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
