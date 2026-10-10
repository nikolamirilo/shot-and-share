import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GuestLoader } from "@/components/event/guest-loader";

/**
 * The screen between tapping a share link and the event arriving.
 *
 * The page is `force-dynamic` and waits on four round trips before it can draw
 * anything, so without this the tap did nothing at all for a second or two -
 * which reads as a dead QR code at the one moment the product has to look like
 * it works.
 */
describe("the guest page's loading screen", () => {
  const html = renderToStaticMarkup(<GuestLoader />);

  it("says it is working, to a screen reader as well as to an eye", () => {
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("getting the photos ready");
  });

  it("fills the screen the page is about to fill", () => {
    // Anything shorter is a strip of loading state above a blank page.
    expect(html).toContain("min-h-dvh");
  });

  it("is the mark, and nothing drawn on top of it", () => {
    // A guest is waiting two seconds, not watching something. One object
    // doing one thing: breathing, with its frame leaving it in echoes.
    expect(html).toContain("Shot &amp; Share");
    expect(html).toContain("mark-breathe");
    expect(html.match(/mark-echo/g)).toHaveLength(2);
  });

  it("staggers the echoes so one is always leaving", () => {
    // Both on the same beat is a blink rather than a pulse.
    expect(html).toContain("animation-delay:1200ms");
  });

  it("opens on the page's own colour, not on the cover's", () => {
    // A light screen going dark once is a photograph landing. A dark screen
    // going light is a flash of the wrong page - and three of the four covers
    // are not dark at all.
    expect(html).toContain("bg-linen");
  });
});
