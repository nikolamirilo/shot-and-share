import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { hasDecoded } from "@/components/event/CoverImage";
import { EventCover, EventThemeRoot } from "@/components/event/EventCover";
import { EventPreview } from "@/components/event/EventPreview";
import { UploadPanel } from "@/components/upload/UploadPanel";
import { THEMES, buildCustomPalette } from "@/lib/appearance";
import { findFontSet } from "@/lib/fonts";
import { GALLERY_LAYOUTS, type GalleryLayout } from "@/constants/gallery";
import { uploadWording } from "@/lib/media";
import { TIERS } from "@/lib/tiers";

const palette = THEMES[0].palette;

describe("the cover a host is shown", () => {
  it("shows the variant that was picked before a photo exists", () => {
    for (const variant of ["full", "classic", "half"] as const) {
      const html = renderToStaticMarkup(
        <EventCover
          variant={variant}
          name="Your event"
          coverUrl={null}
          palette={palette}
          preview
        />,
      );
      expect(html).toContain("your photo");
    }
  });

  it("still falls back to type on the guest page itself", () => {
    const html = renderToStaticMarkup(
      <EventCover
        variant="classic"
        name="Your event"
        coverUrl={null}
        palette={palette}
      />,
    );
    expect(html).not.toContain("your photo");
  });

  it("lets the full-screen cover take the room the header left it", () => {
    const html = renderToStaticMarkup(
      <EventCover
        variant="full"
        name="Your event"
        coverUrl="https://example.test/thumb.jpg"
        palette={palette}
      />,
    );
    expect(html).toContain("flex-1");
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
    for (const variant of ["button", "panel", "bar", "split"] as const) {
      const guest = renderToStaticMarkup(
        <UploadPanel
          variant={variant}
          label="Add your photos"
          hint="Photos, up to 20 at a time."
        />,
      );
      expect(guest).toContain("Photos, up to 20 at a time.");
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

function preview(props: Partial<Parameters<typeof EventPreview>[0]> = {}) {
  return renderToStaticMarkup(
    <EventPreview
      name="Romeo and Juliet"
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
    const html = preview();

    expect(html).toContain("Romeo and Juliet");
    expect(html).toContain("Add your photos");
    expect(html).toContain(uploadWording(TIERS.free).hint);
    expect(html).toContain("Everyone&#x27;s photos");
  });

  it("asks for video on a plan that takes video", () => {
    const html = preview({ wording: uploadWording(TIERS.pro) });

    expect(html).toContain("Add your photos and video");
    expect(html).toContain("Photos and video");
  });

  it("draws the cover photo the host picked, and only that one", () => {
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
    const drawn = new Map<GalleryLayout, string>();
    for (const layout of GALLERY_LAYOUTS) {
      drawn.set(layout.id, preview({ layout: layout.id }));
    }

    expect(new Set(drawn.values()).size).toBe(GALLERY_LAYOUTS.length);
    expect(drawn.get("grid")).toContain("grid-cols-3");
    expect(drawn.get("masonry")).toContain("columns-2");
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
    expect(html).toContain("--color-well:");
  });

  it("paints the drawn upload button in the accent colour", () => {
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

describe("the name's position on the cover", () => {
  function cover(props: Partial<Parameters<typeof EventCover>[0]> = {}) {
    return renderToStaticMarkup(
      <EventCover
        variant="full"
        name="Romeo and Juliet"
        coverUrl="https://media.example.com/photo.jpg"
        palette={palette}
        {...props}
      />,
    );
  }

  it("leaves the cover alone when nothing was chosen", () => {
    const before = cover();
    expect(before).toBe(cover({ position: "bottom-left" }));
    expect(before).toContain("linear-gradient(to top");
    expect(before).toContain("inset-x-0 bottom-0");
  });

  it("turns the wash over when the name goes to the top", () => {
    const html = cover({ position: "top-left" });

    expect(html).toContain("linear-gradient(to bottom");
    expect(html).not.toContain("linear-gradient(to top,");
    expect(html).toContain("inset-x-0 top-0");
  });

  it("puts a scrim under a name in the middle", () => {
    const html = cover({ position: "middle-centre" });

    expect(html).toContain("radial-gradient");
    expect(html).toContain("text-center");
  });

  it("moves the scrim sideways with the name", () => {
    expect(cover({ position: "middle-left" })).toContain("at 26% 50%");
    expect(cover({ position: "middle-right" })).toContain("at 74% 50%");
  });

  it("aligns the type and the cue with it", () => {
    const right = cover({ position: "bottom-right" });
    expect(right).toContain("text-right");
    expect(right).toContain("justify-end");

    const centre = cover({ position: "bottom-centre" });
    expect(centre).toContain("text-center");
    expect(centre).toContain("justify-center");
  });

  it("keeps the scroll cue at the foot when the name leaves it", () => {
    for (const position of ["middle-centre", "top-right"] as const) {
      const html = cover({ position });
      expect(html).toContain("add your photos");
      expect(html).toContain("absolute inset-x-0 bottom-0");
    }

    const foot = cover({ position: "bottom-left" });
    expect(foot).toContain("add your photos");
    expect(foot).not.toContain("absolute inset-x-0 bottom-0 mx-auto max-w-3xl text-white");

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

describe("the cover while it is still loading", () => {
  const PHOTO = "https://media.example.com/full.jpg";
  const THUMB = "https://media.example.com/thumb.webp";

  it("puts the blurred thumbnail in while the full copy is in flight", () => {
    const html = renderToStaticMarkup(
      <EventCover
        variant="full"
        name="Romeo and Juliet"
        coverUrl={PHOTO}
        coverPreviewUrl={THUMB}
        palette={palette}
      />,
    );

    expect(html).toContain(THUMB);
    expect(html).toContain("blur-xl");
    expect(html).toContain(PHOTO);
    expect(html).toContain("opacity-0");
  });

  it("falls back to a frame with a light over it when there is no thumbnail", () => {
    const html = renderToStaticMarkup(
      <EventCover
        variant="classic"
        name="Romeo and Juliet"
        coverUrl={PHOTO}
        palette={palette}
      />,
    );

    expect(html).toContain("cover-sweep");
    expect(html).toContain("bg-well");
  });

  it("does not fade in the host's preview", () => {
    const html = renderToStaticMarkup(
      <EventCover
        variant="full"
        name="Romeo and Juliet"
        coverUrl={PHOTO}
        coverPreviewUrl={THUMB}
        palette={palette}
        preview
      />,
    );

    expect(html).toContain(PHOTO);
    expect(html).not.toContain(THUMB);
    expect(html).not.toContain("transition-opacity");
  });
});

describe("deciding the cover has arrived", () => {
  it("waits for pixels, not just for the browser to stop trying", () => {
    expect(hasDecoded({ complete: true, naturalWidth: 0 })).toBe(false);
    expect(hasDecoded({ complete: true, naturalWidth: 2560 })).toBe(true);
  });

  it("is not ready before the browser has finished", () => {
    expect(hasDecoded({ complete: false, naturalWidth: 0 })).toBe(false);
    expect(hasDecoded(null)).toBe(false);
  });
});
