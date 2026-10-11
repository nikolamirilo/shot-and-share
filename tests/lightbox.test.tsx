import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Lightbox } from "@/components/gallery/Lightbox";
import { type MediaView } from "@/types/media";

const PHOTO: MediaView = {
  id: "photo-1",
  kind: "photo",
  width: 1200,
  height: 1600,
  previewUrl: "/hero/variants/01.jpg",
  fullUrl: "/hero/variants/01.jpg",
  createdAt: "2026-01-01T00:00:00.000Z",
  takenAt: "2026-01-01T00:00:00.000Z",
  uploaderFingerprint: null,
  sizeBytes: 1000,
  posterUrl: null,
  durationSeconds: null,
  processing: false,
  format: "jpeg",
};

function markup(over: Partial<Parameters<typeof Lightbox>[0]> = {}) {
  return renderToStaticMarkup(
    <Lightbox
      token="token"
      demo
      item={PHOTO}
      prev={{ ...PHOTO, id: "photo-0" }}
      next={{ ...PHOTO, id: "photo-2" }}
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
    expect(markup()).toContain("h-[100dvh]");
  });

  it("has a real height, so the picture inside it can be bounded by one", () => {
    const frame = /class="relative flex ([^"]*)"/.exec(markup())?.[1] ?? "";
    expect(frame).toContain("h-full");
    expect(frame).not.toContain("max-h-full");
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

    expect(html.indexOf("<img")).toBeLessThan(layer);
    for (const control of ['aria-label="Close"', "Download", "Report"]) {
      expect(html.indexOf(control)).toBeGreaterThan(layer);
    }
  });

  it("take clicks even though the layer holding them does not", () => {
    const html = markup();
    expect(html).toContain("pointer-events-auto");
    expect(html.match(/pointer-events-auto/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("step aside on a touch screen, where the photo itself is the control", () => {
    const html = markup();
    const arrow = /<button[^>]*aria-label="Next photo"[^>]*>/.exec(html)?.[0] ?? "";
    expect(arrow).toContain("pointer-coarse:sr-only");
    expect(arrow).not.toMatch(/(^|\s)hidden(\s|")/);
  });

  it("drop the arrows when there is nowhere to step", () => {
    const alone = markup({ prev: null, next: null, total: 1, position: 1 });
    expect(alone).not.toContain('aria-label="Previous photo"');
    expect(alone).not.toContain('aria-label="Next photo"');
    expect(alone).not.toContain("1 of 1");
  });
});

describe("the photographs fetched ahead", () => {
  const ahead = [
    { ...PHOTO, id: "photo-2" },
    { ...PHOTO, id: "photo-3" },
  ];

  it("wait until the photograph on screen has arrived", () => {
    const html = markup({ preload: ahead });
    expect(html.match(/<img/g)).toHaveLength(1);
  });
});

describe("the strip", () => {
  it("holds the photo on each side, out of the way of a screen reader", () => {
    const html = markup();
    expect(html.match(/aria-hidden="true" class="absolute inset-0 flex/g)).toHaveLength(2);
    expect(html).toContain("translate3d(calc(-100% + -16px), 0, 0)");
    expect(html).toContain("translate3d(calc(100% + 16px), 0, 0)");
  });

  it("leaves out a side that is not there", () => {
    const first = markup({ prev: null });
    expect(first.match(/aria-hidden="true" class="absolute inset-0 flex/g)).toHaveLength(1);
    expect(first).not.toContain("translate3d(calc(-100%");
  });

  it("fetches the photos either side only once this one has arrived", () => {
    expect(markup().match(/<img/g)).toHaveLength(1);
  });

  it("marks the photograph as the place a tap turns the page", () => {
    expect(markup()).toMatch(/<img[^>]*data-picture=""/);
  });

  it("keeps pinch-zoom but takes the page's own scrolling off a swipe", () => {
    expect(markup()).toContain("touch-action:pinch-zoom");
  });
});
