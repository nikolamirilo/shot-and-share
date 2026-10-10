import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EventAdminView } from "@/components/dashboard/event-admin-view";
import { findTheme, resolveAppearance } from "@/lib/appearance";
import type { MediaView } from "@/lib/media-view";
import { TIERS } from "@/lib/tiers";

/**
 * The console's Event tab: the event page itself, with the host standing on it.
 *
 * It replaced a dashboard panel listing photographs, and the whole point of
 * the replacement is that it is not an approximation - the host is looking at
 * the real cover, the real colours and the real wall. The things these tests
 * pin down are the three ways that promise quietly breaks: the tab drawing its
 * own layout instead of the event's, the settings creeping back onto it, and
 * the host losing the powers they had on the old panel.
 */

/** The wall the host sees is the one the gallery would render for a guest. */
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

/** A paid event, which is the only kind that has styling of its own. */
function event(over: Record<string, unknown> = {}) {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    name: "Romeo and Juliet",
    welcome_message: "Bring the camera",
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
    // The theme and the photograph, not the dashboard's claret and a thumbnail
    // grid. Sage's background, straight off the palette.
    const html = render();
    expect(html).toContain(`--color-linen:${findTheme("sage").palette.bg}`);
    expect(html).toContain("https://cdn.test/cover.jpg");
    expect(html).toContain("Romeo and Juliet");
  });

  it("lays the wall out the way the event does, not the way this tab likes", () => {
    // Masonry deals its columns in JavaScript and renders one list per column;
    // Grid is a single container. Either way the layout comes from the event.
    expect(render().match(/<ul/g)).toHaveLength(2);
    expect(render({ gallery_layout: "grid" })).toContain("grid-cols-3");
  });

  it("has no layout switcher, because nothing here changes the event", () => {
    // The layout is one setting with one home, under Edit. A private view of
    // the wall is exactly what a host judging their own page must not have.
    const html = render();
    expect(html).not.toContain('aria-label="Gallery layout"');
    for (const layout of ["Circles", "Masonry", "Stack"]) {
      expect(html).not.toContain(`>${layout}<`);
    }
  });

  it("caps the screen-filling cover so the photographs are not a screen down", () => {
    // "Full screen" means the screen on the guest page. In a tab it would put
    // the wall - the reason the host opened the tab - below the fold.
    const html = render();
    expect(html).toContain("h-[60svh]");
    expect(html).not.toMatch(/class="[^"]*h-svh/);
  });

  it("keeps the host's powers on the wall", () => {
    // Selecting is how both deleting and choosing a cover start, so the hint
    // is the whole moderation path on this tab in one line.
    expect(render()).toContain("Tap a photo to select it.");
  });

  it("puts anything waiting on the host above the page", () => {
    // A reported photograph is already hidden from guests, so it is not on the
    // wall below - this queue is the only place the host meets it.
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
    // Which is nearly every event, every evening. A panel saying "nothing to
    // review" on every visit teaches hosts to skip past it.
    expect(render()).not.toContain("Waiting on you");
  });

  it("says when the gallery is off, and still shows the host everything", () => {
    const html = render({ gallery_visible: false });
    expect(html).toContain("The gallery is turned off.");
    expect(html).toContain("Tap a photo to select it.");
  });

  it("carries none of the numbers, which belong on the plan", () => {
    // They moved to Plan, where the meter and the price of more room are.
    // Four stats above the cover made this tab a report rather than a page.
    const html = render();
    expect(html).not.toContain("Phones that uploaded");
    expect(html).not.toContain("Storage");
  });
});
