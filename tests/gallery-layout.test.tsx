import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PhotoGallery } from "@/components/gallery/PhotoGallery";
import { type GalleryLayout } from "@/constants/gallery";
import { type MediaView } from "@/types/media";

function photos(count: number): MediaView[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `photo-${i + 1}`,
    kind: "photo" as const,
    width: 1200,
    height: 900,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, count - i)).toISOString(),
    takenAt: new Date(Date.UTC(2026, 0, 1, 0, count - i)).toISOString(),
    uploaderFingerprint: null,
    sizeBytes: 1000,
    previewUrl: `/preview/${i + 1}.jpg`,
    fullUrl: `/full/${i + 1}.jpg`,
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

function frames(html: string): number {
  return (html.match(/animate-pulse/g) ?? []).length;
}

function order(html: string): number[] {
  return [
    ...html.matchAll(/src="[^"]*%2F(?:preview|full)%2F(\d+)\.jpg/g),
  ].map((m) => Number(m[1]));
}

function columns(html: string): number[][] {
  return html
    .split("<ul")
    .slice(1)
    .map(order);
}

describe("the masonry wall", () => {
  it("keeps each column newest first below the top row", () => {
    expect(columns(markup("masonry", photos(6)))).toEqual([
      [1, 3, 5],
      [2, 4, 6],
    ]);
  });
});

describe("filling the wall", () => {
  it("asks for the first ten photographs and no more", () => {
    expect(order(markup("grid", photos(25)))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("shimmers the ones whose turn has not come", () => {
    expect(frames(markup("grid", photos(25)))).toBe(15);
  });

  it("takes the turn from the gallery's order, not the column's", () => {
    expect(columns(markup("masonry", photos(25)))).toEqual([
      [1, 3, 5, 7, 9],
      [2, 4, 6, 8, 10],
    ]);
  });
});

describe("frames for photographs on their way", () => {
  it("draws the whole wall as frames before the first page arrives", () => {
    for (const layout of ["grid", "masonry", "holes"] as const) {
      expect(frames(markup(layout, [], 10))).toBe(10);
    }
  });

  it("puts them after the photographs already on the wall", () => {
    const html = markup("grid", photos(5), 10);
    expect(order(html)).toEqual([1, 2, 3, 4, 5]);
    expect(html.indexOf("animate-pulse")).toBeGreaterThan(
      html.lastIndexOf("%2Fpreview%2F5"),
    );
  });
});

describe("thumbnail against full copy", () => {
  it("loads the thumbnail in every layout that shows many at once", () => {
    for (const layout of ["grid", "holes", "masonry"] as const) {
      const html = markup(layout, photos(3));
      expect(html, layout).toContain("%2Fpreview%2F1.jpg");
      expect(html, layout).not.toContain("%2Ffull%2F");
    }
  });

  it("loads the full copy in Stack, which shows one at a time", () => {
    const html = markup("stack", photos(3));
    expect(html).toContain("%2Ffull%2F1.jpg");
    expect(html).not.toContain("%2Fpreview%2F");
  });
});

describe("marking a video on the wall", () => {
  function clip(): MediaView {
    return { ...photos(1)[0], kind: "video", durationSeconds: 12 };
  }

  const PLAY = "M8 5v14l11-7z";

  it("puts a play button on a video in every layout", () => {
    for (const layout of ["grid", "masonry", "holes", "stack"] as const) {
      expect(markup(layout, [clip()]), layout).toContain(PLAY);
    }
  });
});
