import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EventCover, EventThemeRoot } from "@/components/event-cover";
import { UploadPanel } from "@/components/upload-panel";
import { THEMES, buildCustomPalette } from "@/lib/appearance";
import { findFontSet } from "@/lib/fonts";

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
    for (const variant of ["classic", "band", "framed"] as const) {
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

  it("uses the photo once there is one", () => {
    const html = renderToStaticMarkup(
      <EventCover
        variant="band"
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
