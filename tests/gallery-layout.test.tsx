import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PhotoGallery } from "@/components/gallery/photo-gallery";
import type { GalleryLayout } from "@/lib/gallery";
import type { MediaView } from "@/lib/media-view";

/**
 * Where each photograph lands on the wall.
 *
 * The gallery is served newest first, and every layout has to keep that
 * promise on screen - not only in the array it was handed. Masonry is the one
 * that broke it: CSS columns fill top to bottom, so the newest photographs ran
 * down the left edge and the top row was four different points in the evening.
 */

/** Numbered so their position in the markup is readable. */
function photos(count: number): MediaView[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `photo-${i + 1}`,
    kind: "photo" as const,
    width: 1200,
    height: 900,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, count - i)).toISOString(),
    uploaderName: null,
    uploaderFingerprint: null,
    sizeBytes: 1000,
    previewUrl: `/preview/${i + 1}.jpg`,
    posterUrl: null,
    durationSeconds: null,
    processing: false,
    format: "image/jpeg",
  }));
}

function markup(layout: GalleryLayout, items: MediaView[], pending = 0) {
  return renderToStaticMarkup(
    <PhotoGallery
      items={items}
      layout={layout}
      pending={pending}
      onActivate={() => {}}
    />,
  );
}

/**
 * Empty frames standing in for photographs on their way. Counted by the pulse,
 * which is the one thing every frame has and nothing else on the wall does.
 */
function frames(html: string): number {
  return (html.match(/animate-pulse/g) ?? []).length;
}

/**
 * The photo numbers in the markup, in order. The optimiser rewrites every src
 * into `/_next/image?url=…`, and lists ten of them in `srcSet` besides, so it
 * is the one `src` attribute per tile that says what is on the page.
 */
function order(html: string): number[] {
  return [...html.matchAll(/src="[^"]*%2Fpreview%2F(\d+)\.jpg/g)].map((m) =>
    Number(m[1]),
  );
}

/** Which photo each column holds, in the order the column holds them. */
function columns(html: string): number[][] {
  return html
    .split("<ul")
    .slice(1)
    .map(order);
}

describe("the masonry wall", () => {
  it("puts the newest photographs along the top row", () => {
    // Two columns is what renders before the browser has measured anything,
    // which is what a server render sees. Dealt across rather than poured down
    // each column: the two newest are the two at the top, not photos 1 and 4.
    const heads = columns(markup("masonry", photos(6))).map((c) => c[0]);
    expect(heads).toEqual([1, 2]);
  });

  it("keeps each column newest first below the top row", () => {
    expect(columns(markup("masonry", photos(6)))).toEqual([
      [1, 3, 5],
      [2, 4, 6],
    ]);
  });

  it("holds every photograph exactly once", () => {
    const all = columns(markup("masonry", photos(7))).flat().sort((a, b) => a - b);
    expect(all).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("filling the wall", () => {
  /**
   * Handing the browser a whole page of images at once is what made the wall
   * fill in at random: they start together and finish in whatever order their
   * file sizes settle on. These render without effects, which is exactly the
   * first wave - ten, and nothing else asked of the network yet.
   */
  it("asks for the first ten photographs and no more", () => {
    expect(order(markup("grid", photos(25)))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("still holds a place for the ones whose turn has not come", () => {
    // Held, not dropped. The wall keeps its full height so it does not grow
    // under a thumb that is already scrolling.
    expect(markup("grid", photos(25)).match(/<li>/g)).toHaveLength(25);
  });

  it("shimmers the ones whose turn has not come", () => {
    // Twenty-five on the wall, ten in the first wave, so fifteen are waiting.
    // A still, empty well would be the picture the wall shows for a photograph
    // that failed - these have simply not been asked for yet.
    expect(frames(markup("grid", photos(25)))).toBe(15);
  });

  it("takes the turn from the gallery's order, not the column's", () => {
    // Masonry, two columns: the ten newest are the top five of each column,
    // not the first ten of the left one.
    expect(columns(markup("masonry", photos(25)))).toEqual([
      [1, 3, 5, 7, 9],
      [2, 4, 6, 8, 10],
    ]);
  });
});

describe("frames for photographs on their way", () => {
  /**
   * A tap on "Show more" used to change nothing on screen for a second or two
   * while the page was fetched, which is indistinguishable from a button that
   * did not work. The frames are the answer to the tap.
   */
  it("draws the whole wall as frames before the first page arrives", () => {
    // Every layout, because the empty container was on all of them.
    for (const layout of ["grid", "masonry", "holes"] as const) {
      expect(frames(markup(layout, [], 10))).toBe(10);
    }
  });

  it("keeps them out of the way on Stack", () => {
    // One photograph per screen, so ten frames is six thousand pixels of
    // shimmer for a page nobody has scrolled to yet.
    expect(frames(markup("stack", [], 10))).toBe(3);
  });

  it("puts them after the photographs already on the wall", () => {
    const html = markup("grid", photos(5), 10);
    expect(order(html)).toEqual([1, 2, 3, 4, 5]);
    // Five real tiles, and the ten frames sit past them rather than replacing
    // what the guest is already looking at.
    expect(html.indexOf("animate-pulse")).toBeGreaterThan(
      html.lastIndexOf("%2Fpreview%2F5"),
    );
  });

  it("deals them across the masonry columns", () => {
    // Two columns before the browser has measured anything. A tail of ten on
    // the left would make the wall lopsided as it grew.
    const lanes = markup("masonry", photos(4), 4)
      .split("<ul")
      .slice(1)
      .map(frames);
    expect(lanes).toEqual([2, 2]);
  });

  it("draws none when nothing is on its way", () => {
    // Including the tiles waiting their turn in the loading queue, which wear
    // the same shimmer - photos(5) is under one wave, so none of them do.
    expect(frames(markup("grid", photos(5)))).toBe(0);
  });
});

describe("the other layouts", () => {
  it("render photographs in the order they were given", () => {
    // Grid, Circles and Stack are all one flow, so source order is what shows.
    for (const layout of ["grid", "holes", "stack"] as const) {
      expect(order(markup(layout, photos(5))), layout).toEqual([1, 2, 3, 4, 5]);
    }
  });
});

/**
 * Telling a clip apart from a photograph, before opening it.
 *
 * The wall used to say so with the word "video" on a pill in one corner, which
 * is our label rather than the one every camera roll on earth already uses -
 * and on a busy frame it disappeared into the picture. A triangle in a circle,
 * in the middle, is the thing people already know.
 */
describe("marking a video on the wall", () => {
  function clip(): MediaView {
    return { ...photos(1)[0], kind: "video", durationSeconds: 12 };
  }

  /** The play triangle's path data, which only the video overlay draws. */
  const PLAY = "M8 5v14l11-7z";

  it("puts a play button on a video in every layout", () => {
    for (const layout of ["grid", "masonry", "holes", "stack"] as const) {
      expect(markup(layout, [clip()]), layout).toContain(PLAY);
    }
  });

  it("leaves photographs alone", () => {
    expect(markup("grid", photos(3))).not.toContain(PLAY);
  });

  it("no longer labels it in words", () => {
    const html = markup("grid", [clip()]);
    // The aria-label still says "video" - that is the accessible name, not a
    // badge drawn over the picture.
    expect(html).not.toContain(">video<");
  });
});
