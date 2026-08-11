import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TabPanel, Tabs, type TabItem } from "@/components/ui/tabs";

/**
 * The host's console shows one group at a time at every width - a strip across
 * the top of a phone, a rail down the side of a laptop. Both the switching and
 * the two shapes of the buttons are done in CSS, which is exactly the kind of
 * thing that gets quietly undone by a later class change.
 */

const ITEMS: TabItem[] = [
  { id: "share", label: "Share" },
  { id: "upgrade", label: "Plan" },
  { id: "settings", label: "Settings" },
];

function render() {
  return renderToStaticMarkup(
    <Tabs items={ITEMS} label="Event sections" desktop="rail" sticky>
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
    // switching tabs keeps what they typed, and the whole console arrives in
    // the first response.
    const html = render();
    expect(html).toContain("the share panel");
    expect(html).toContain("the plan panel");
    expect(html).toContain("the settings panel");
  });

  it("opens the first tab and closes the rest at every width", () => {
    // `hidden lg:block` was right while a laptop showed the whole console at
    // once. It would now leave every panel stacked behind the rail.
    const html = render();
    expect(html).toContain('id="share"');
    expect(html).not.toMatch(/id="share"[^>]*class="[^"]*hidden/);
    expect(html).toMatch(/id="upgrade"[^>]*class="hidden/);
    expect(html).toMatch(/id="settings"[^>]*class="hidden/);
    expect(html).not.toMatch(/id="(upgrade|settings)"[^>]*lg:(block|grid)/);
  });

  it("keeps a closed grid panel a grid when it reopens", () => {
    // A two-column row that comes back as a block is the panel arriving
    // stacked on the one screen wide enough to show it side by side.
    const html = render();
    expect(html).toMatch(/id="share"[^>]*class="grid/);
  });

  it("keeps the strip on the screens that used to hide it", () => {
    const html = render();
    expect(html).toMatch(/role="tablist"/);
    expect(html).not.toMatch(/role="tablist"[^>]*class="[^"]*lg:hidden/);
  });

  it("stands the rail up beside the panel on a laptop", () => {
    // The two halves of a rail: a column of buttons, and a grid to put that
    // column and the open panel in. Either one alone is a broken layout.
    const html = render();
    expect(html).toMatch(/role="tablist"[^>]*class="[^"]*lg:flex-col/);
    expect(html).toMatch(/lg:grid-cols-\[13rem_1fr\]/);
  });

  it("leaves a strip horizontal on a laptop", () => {
    const html = renderToStaticMarkup(
      <Tabs items={ITEMS} label="Event page settings" idPrefix="look">
        <TabPanel id="share">the share panel</TabPanel>
      </Tabs>,
    );
    expect(html).not.toContain("lg:flex-col");
    expect(html).not.toContain("lg:grid-cols-[13rem_1fr]");
    expect(html).toContain('aria-orientation="horizontal"');
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

/**
 * Six pills are 592px of content and no phone is that wide, so below `sm` the
 * same row is pinned across the bottom of the screen instead of scrolling off
 * the side of it.
 */
const BAR: TabItem[] = [
  { id: "share", label: "Share", short: "Share", icon: <span>·</span> },
  { id: "page", label: "Event page", short: "Page", icon: <span>·</span> },
];

function renderBar() {
  return renderToStaticMarkup(
    <Tabs items={BAR} label="Event sections" desktop="rail" mobile="bar" sticky>
      <TabPanel id="share">the share panel</TabPanel>
      <TabPanel id="page">the page panel</TabPanel>
    </Tabs>,
  );
}

describe("the bottom bar on a phone", () => {
  it("pins the row to the bottom, and stops at sm", () => {
    const html = renderBar();
    const list = /role="tablist"[^>]*class="([^"]*)"/.exec(html)![1];
    expect(list).toContain("fixed");
    expect(list).toContain("bottom-0");
    expect(list).toContain("grid-cols-6");
    // From `sm` up it is the strip it always was, in the flow of the page.
    expect(list).toContain("sm:static");
    expect(list).toContain("sm:flex");
  });

  it("does not pin the strip when the bar was not asked for", () => {
    // Every other set of tabs in the product - the event page editor's own -
    // must keep both feet on the ground.
    const html = render();
    expect(html).not.toContain("bottom-0");
    expect(html).not.toContain("grid-cols-6");
  });

  it("is one tablist, not a bar and a strip", () => {
    // Two rows over one set of panels would mean two elements carrying
    // id="share-tab", and every aria-labelledby pointing at whichever the
    // browser found first.
    const html = renderBar();
    expect(html.match(/role="tablist"/g)).toHaveLength(1);
    expect(html.match(/id="share-tab"/g)).toHaveLength(1);
  });

  it("keeps the full label as the accessible name at every width", () => {
    // The bar has room for "Page". A screen reader should still hear
    // "Event page", which is what the tab is called everywhere else.
    const html = renderBar();
    expect(html).toContain("Event page");
    expect(html).toContain("sr-only sm:not-sr-only");
    // The short name and the icon are decoration on top of it, not instead.
    expect(html.match(/aria-hidden="true"/g)?.length ?? 0).toBeGreaterThan(1);
  });
});
