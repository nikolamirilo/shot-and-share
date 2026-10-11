import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GuestLoader } from "@/components/event/GuestLoader";

describe("the guest page's loading screen", () => {
  const html = renderToStaticMarkup(<GuestLoader />);

  it("says it is working, to a screen reader as well as to an eye", () => {
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("getting the photos ready");
  });

  it("fills the screen the page is about to fill", () => {
    expect(html).toContain("min-h-dvh");
  });

  it("is the mark, and nothing drawn on top of it", () => {
    expect(html).toContain("Shot &amp; Share");
    expect(html).toContain("mark-breathe");
    expect(html.match(/mark-echo/g)).toHaveLength(2);
  });

  it("staggers the echoes so one is always leaving", () => {
    expect(html).toContain("animation-delay:1200ms");
  });

  it("opens on the page's own colour, not on the cover's", () => {
    expect(html).toContain("bg-linen");
  });
});
