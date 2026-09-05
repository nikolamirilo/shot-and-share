import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SharePanel } from "@/components/dashboard/share-panel";

/**
 * The panel has one job in each state, and the wrong button in the wrong state
 * costs a host every printed card they put on a table.
 */

const draw = (props: Partial<Parameters<typeof SharePanel>[0]>) =>
  renderToStaticMarkup(
    <SharePanel
      eventId="11111111-2222-3333-4444-555555555555"
      link={null}
      brandedQr={false}
      state="none"
      opens={0}
      uploaders={0}
      {...props}
    />,
  );

describe("the share panel", () => {
  it("offers a new link only when the host turned theirs off", () => {
    expect(draw({ state: "none" })).toContain("Issue a new link");
  });

  it("asks for the link back when it cannot read the one it has", () => {
    const html = draw({ state: "unreadable" });

    // Said plainly, because the host is looking at a page with no QR code on it
    // and the truth is that nothing is broken for their guests.
    expect(html).toContain("still works");
    expect(html).toContain("Restore this link");
    expect(html).toContain("Your event link");
    // Reissuing is still reachable, and is not what the panel leads with.
    expect(html.indexOf("Restore this link")).toBeLessThan(
      html.indexOf("Issue a new link instead"),
    );
  });

  it("shows the code and the buttons once there is a link", () => {
    const html = draw({
      state: "active",
      link: "https://www.shotandshare.com/e/abc",
    });

    expect(html).toContain("Copy link");
    expect(html).toContain("qr?format=code");
    expect(html).not.toContain("Restore this link");
  });
});
