import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TabPanel, Tabs, type TabItem } from "@/components/tabs";

/**
 * The host's console is one column two thumbs long on a phone, so its groups
 * are tabs there and stay open on a laptop. Both halves of that sentence are
 * load-bearing, and both are done in CSS - which is exactly the kind of thing
 * that gets quietly undone by a later class change.
 */

const ITEMS: TabItem[] = [
  { id: "share", label: "Share" },
  { id: "upgrade", label: "Plan" },
  { id: "settings", label: "Settings" },
];

function render() {
  return renderToStaticMarkup(
    <Tabs items={ITEMS} label="Event sections" sticky>
      <TabPanel id="share" display="grid">
        the share panel
      </TabPanel>
      <TabPanel id="upgrade">the plan panel</TabPanel>
      <TabPanel id="settings">the settings panel</TabPanel>
    </Tabs>,
  );
}

describe("the tabs on the event console", () => {
  it("ships every panel, open or not", () => {
    // Closed is a display rule, not a reason to leave the markup out: a host
    // switching tabs keeps what they typed, and a laptop gets the whole page
    // in the first response.
    const html = render();
    expect(html).toContain("the share panel");
    expect(html).toContain("the plan panel");
    expect(html).toContain("the settings panel");
  });

  it("opens the first tab and closes the rest on a phone only", () => {
    // `hidden` on its own would hide the panel on a laptop too, where there is
    // no strip to open it again with.
    const html = render();
    expect(html).toContain('id="share"');
    expect(html).not.toMatch(/id="share"[^>]*class="[^"]*hidden/);
    expect(html).toMatch(/id="upgrade"[^>]*class="hidden lg:block/);
    expect(html).toMatch(/id="settings"[^>]*class="hidden lg:block/);
  });

  it("keeps a closed grid panel a grid when it reopens", () => {
    // A two-column row that comes back as a block is the panel arriving
    // stacked on the one screen wide enough to show it side by side.
    const html = render();
    expect(html).toMatch(/id="share"[^>]*class="grid/);
  });

  it("hides the strip itself once the whole console fits", () => {
    expect(render()).toMatch(/role="tablist"[^>]*class="[^"]*lg:hidden/);
  });

  it("points each tab at the panel it opens", () => {
    // `#upgrade` is a link target elsewhere in the product, so the panel id is
    // the tab id rather than something generated.
    const html = render();
    expect(html).toContain('aria-controls="upgrade"');
    expect(html).toContain('id="upgrade-tab"');
    expect(html).toMatch(/id="upgrade"[^>]*aria-labelledby="upgrade-tab"/);
  });

  it("namespaces its ids when a second set of tabs is on the same page", () => {
    // The event page editor sits inside a panel of the console and has tabs of
    // its own. Two elements with id="gallery" would break both.
    const html = renderToStaticMarkup(
      <Tabs
        items={[{ id: "gallery", label: "Gallery" }]}
        label="Event page settings"
        idPrefix="look"
      >
        <TabPanel id="gallery">the gallery group</TabPanel>
      </Tabs>,
    );
    expect(html).toContain('id="look-gallery"');
    expect(html).toContain('aria-controls="look-gallery"');
  });
});
