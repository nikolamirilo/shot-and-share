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

function markup(layout: GalleryLayout, items: MediaView[]) {
  return renderToStaticMarkup(
    <PhotoGallery items={items} layout={layout} onActivate={() => {}} />,
  );
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

describe("the other layouts", () => {
  it("render photographs in the order they were given", () => {
    // Grid, Circles and Stack are all one flow, so source order is what shows.
    for (const layout of ["grid", "holes", "stack"] as const) {
      expect(order(markup(layout, photos(5))), layout).toEqual([1, 2, 3, 4, 5]);
    }
  });
});
