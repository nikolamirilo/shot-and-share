import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EventAdminView } from "@/components/dashboard/EventAdminView";
import { findTheme, resolveAppearance } from "@/lib/appearance";
import { type MediaView } from "@/types/media";
import { TIERS } from "@/lib/tiers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

function photo(id: string, over: Partial<MediaView> = {}): MediaView {
  return {
    id,
    kind: "photo",
    width: 1200,
    height: 900,
    createdAt: "2026-08-01T20:00:00.000Z",
    takenAt: "2026-08-01T20:00:00.000Z",
    uploaderFingerprint: null,
    sizeBytes: 1000,
    previewUrl: `/preview/${id}.jpg`,
    fullUrl: `/full/${id}.jpg`,
    posterUrl: null,
    durationSeconds: null,
    processing: false,
    format: "image/jpeg",
    ...over,
  };
}

function event(over: Record<string, unknown> = {}) {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    name: "Romeo and Juliet",
    tier: TIERS.pro.id,
    gallery_visible: true,
    gallery_layout: "masonry",
    theme: "sage",
    theme_font: "classic",
    cover_variant: "full",
    cover_position: "bottom-left",
    upload_variant: "big",
    ...over,
  } as never;
}

function render(over: Record<string, unknown> = {}, props: Partial<Parameters<typeof EventAdminView>[0]> = {}) {
  const row = event(over);
  return renderToStaticMarkup(
    <EventAdminView
      event={row}
      appearance={resolveAppearance(row)}
      media={[photo("1"), photo("2")]}
      review={[]}
      photoCount={2}
      shareLink="https://shot.test/e/abcdef"
      coverUrl="https://cdn.test/cover.jpg"
      coverPreviewUrl={null}
      slideshow
      {...props}
    />,
  );
}

describe("the event, as its host sees it", () => {
  it("dresses the page in the event's own colours and cover", () => {
    const html = render();
    expect(html).toContain(`--color-linen:${findTheme("sage").palette.bg}`);
    expect(html).toContain("https://cdn.test/cover.jpg");
    expect(html).toContain("Romeo and Juliet");
  });

  it("lays the wall out the way the event does, not the way this tab likes", () => {
    expect(render().match(/<ul/g)).toHaveLength(2);
    expect(render({ gallery_layout: "grid" })).toContain("grid-cols-3");
  });

  it("has no layout switcher, because nothing here changes the event", () => {
    const html = render();
    expect(html).not.toContain('aria-label="Gallery layout"');
    for (const layout of ["Circles", "Masonry", "Stack"]) {
      expect(html).not.toContain(`>${layout}<`);
    }
  });

  it("caps the screen-filling cover so the photographs are not a screen down", () => {
    const html = render();
    expect(html).toContain("h-[60svh]");
    expect(html).not.toMatch(/class="[^"]*h-svh/);
  });

  it("keeps the host's powers on the wall", () => {
    expect(render()).toContain("Tap a photo to select it.");
  });

  it("puts anything waiting on the host above the page", () => {
    const html = render(
      {},
      {
        review: [
          photo("3", { review: { state: "reported", labels: [], reports: 1 } }),
        ],
      },
    );
    expect(html).toContain("Waiting on you (1)");
    expect(html.indexOf("Waiting on you")).toBeLessThan(
      html.indexOf("Everyone"),
    );
  });

  it("draws no queue at all when there is nothing in it", () => {
    expect(render()).not.toContain("Waiting on you");
  });

  it("says when the gallery is off, and still shows the host everything", () => {
    const html = render({ gallery_visible: false });
    expect(html).toContain("The gallery is turned off.");
    expect(html).toContain("Tap a photo to select it.");
  });

  it("carries none of the numbers, which belong on the plan", () => {
    const html = render();
    expect(html).not.toContain("Phones that uploaded");
    expect(html).not.toContain("Storage");
  });
});
