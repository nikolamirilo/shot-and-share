import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Lightbox } from "@/components/gallery/lightbox";
import type { MediaView } from "@/lib/media-view";

/**
 * The lightbox's controls have to be on the screen, on top of the picture, on
 * every window a guest can hold.
 *
 * They were not, twice over. They were painted in the event's own colours,
 * which on half the presets are black on black - that is guarded in
 * scrim.test.ts. And they sat in a row *under* the picture, in a column whose
 * height chain was broken: the frame was `max-h-full`, which leaves it
 * auto-height, so `max-h-full` on the picture inside it resolved to nothing.
 * A portrait photo rendered at its full height, overflowed the window, and
 * pushed Close, Download and Report off the bottom of the screen - on a phone,
 * behind the browser's own toolbar, where nothing could reach them.
 *
 * The fix is structural, so these are structural: the frame has a real height,
 * the picture is bounded by it, and every control is laid on the picture
 * rather than queued up underneath it.
 */

const PHOTO: MediaView = {
  id: "photo-1",
  kind: "photo",
  // Deliberately portrait, which is the shape that broke it.
  width: 1200,
  height: 1600,
  previewUrl: "/hero/variants/01.jpg",
  fullUrl: "/hero/variants/01.jpg",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function markup(over: Partial<Parameters<typeof Lightbox>[0]> = {}) {
  return renderToStaticMarkup(
    <Lightbox
      token="token"
      // No signed URL to go and fetch in a static render.
      demo
      item={PHOTO}
      prevId="photo-0"
      nextId="photo-2"
      position={2}
      total={9}
      onStep={() => {}}
      onClose={() => {}}
      onReported={() => {}}
      {...over}
    />,
  );
}

describe("the lightbox's frame", () => {
  it("is the window that exists, not the one with the toolbars hidden", () => {
    // `inset-0` alone is the large viewport on a phone: the bottom of the
    // sheet then lives underneath Safari's toolbar.
    expect(markup()).toContain("h-[100dvh]");
  });

  it("has a real height, so the picture inside it can be bounded by one", () => {
    const frame = /class="relative flex ([^"]*)"/.exec(markup())?.[1] ?? "";
    expect(frame).toContain("h-full");
    // The bug in one class: `max-h-full` here leaves this box auto-height and
    // every percentage height inside it resolves to nothing.
    expect(frame).not.toContain("max-h-full");
  });

  it("bounds the picture both ways", () => {
    const img = /<img[^>]*class="([^"]*)"/.exec(markup())?.[1] ?? "";
    expect(img).toContain("max-h-full");
    expect(img).toContain("max-w-full");
    // Not stretched to fit: whichever edge runs out first holds it.
    expect(img).toContain("h-auto");
    expect(img).toContain("w-auto");
  });
});

describe("the lightbox's controls", () => {
  it("are all there", () => {
    const html = markup();
    expect(html).toContain('aria-label="Close"');
    expect(html).toContain("Download");
    expect(html).toContain("Report");
    expect(html).toContain('aria-label="Previous photo"');
    expect(html).toContain('aria-label="Next photo"');
    expect(html).toContain("2 of 9");
  });

  it("are laid on the picture rather than in a row under it", () => {
    const html = markup();
    const layer = html.indexOf("pointer-events-none absolute inset-0");
    expect(layer).toBeGreaterThan(-1);

    // Painted after the picture, so they are on top of it, and inside the
    // frame, so they cannot be pushed anywhere the frame is not.
    expect(html.indexOf("<img")).toBeLessThan(layer);
    for (const control of ['aria-label="Close"', "Download", "Report"]) {
      expect(html.indexOf(control)).toBeGreaterThan(layer);
    }
  });

  it("take clicks even though the layer holding them does not", () => {
    // The layer is inert so a tap beside the photograph still closes and a
    // swipe still steps; each control turns clicks back on for itself.
    const html = markup();
    expect(html).toContain("pointer-events-auto");
    expect(html.match(/pointer-events-auto/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("clear a video's own controls", () => {
    // The scrub bar is the one strip of a video that has to stay free.
    const video = markup({ item: { ...PHOTO, kind: "video" } });
    expect(video).toContain("pb-12");
    expect(markup()).not.toContain("pb-12");
  });

  it("keep the photograph as the first image on the page", () => {
    // The ones fetched ahead are drawn last, behind the controls, so nothing
    // about this dialog reads the wrong <img> as the picture.
    const html = markup({ preload: [{ ...PHOTO, id: "photo-2" }] });
    const first = html.indexOf("<img");
    expect(html.slice(first, first + 400)).toContain("max-h-full");
  });

  it("drop the arrows when there is nowhere to step", () => {
    const alone = markup({ prevId: null, nextId: null, total: 1, position: 1 });
    expect(alone).not.toContain('aria-label="Previous photo"');
    expect(alone).not.toContain('aria-label="Next photo"');
    // And the counter goes with them: "1 of 1" is not information.
    expect(alone).not.toContain("1 of 1");
  });
});

/**
 * Stepping forward used to mean waiting: the full-size copy is resized by the
 * optimiser on first request, and nobody had asked for it until the guest
 * pressed the arrow. So the ones after this are asked for while this one is
 * being looked at.
 */
describe("the photographs fetched ahead", () => {
  const ahead = [
    { ...PHOTO, id: "photo-2" },
    { ...PHOTO, id: "photo-3" },
  ];

  it("wait until the photograph on screen has arrived", () => {
    /*
     * A first render is a photograph that has not landed yet, and that is the
     * whole point of the wait: six requests at once on a venue's wifi means
     * the picture somebody is actually waiting for arrives sixth.
     */
    const html = markup({ preload: ahead });
    expect(html.match(/<img/g)).toHaveLength(1);
  });

  it("are not something the lightbox needs to be given", () => {
    // The host's own console opens photographs through this too, and gets the
    // same dialog it always had.
    expect(() => markup({ preload: undefined })).not.toThrow();
  });
});
