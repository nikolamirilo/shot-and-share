import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TabPanel, Tabs, type TabItem } from "@/components/ui/tabs";

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
  it("opens the first tab and closes the rest at every width", () => {
    const html = render();
    expect(html).toContain('id="share"');
    expect(html).not.toMatch(/id="share"[^>]*class="[^"]*hidden/);
    expect(html).toMatch(/id="upgrade"[^>]*class="hidden/);
    expect(html).toMatch(/id="settings"[^>]*class="hidden/);
    expect(html).not.toMatch(/id="(upgrade|settings)"[^>]*lg:(block|grid)/);
  });

  it("points each tab at the panel it opens", () => {
    const html = render();
    expect(html).toContain('aria-controls="upgrade"');
    expect(html).toContain('id="upgrade-tab"');
    expect(html).toMatch(/id="upgrade"[^>]*aria-labelledby="upgrade-tab"/);
  });

  it("namespaces its ids when a second set of tabs is on the same page", () => {
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

const BAR: TabItem[] = [
  { id: "share", label: "Share", short: "Share", icon: <span>·</span> },
  { id: "upgrade", label: "Plan and room", short: "Plan", icon: <span>·</span> },
];

function renderBar() {
  return renderToStaticMarkup(
    <Tabs items={BAR} label="Event sections" desktop="rail" mobile="bar" sticky>
      <TabPanel id="share">the share panel</TabPanel>
      <TabPanel id="upgrade">the plan panel</TabPanel>
    </Tabs>,
  );
}

const FIVE: TabItem[] = [
  { id: "share", label: "Share", icon: <span>·</span>, raised: true },
  { id: "event", label: "Event", icon: <span>·</span> },
  { id: "edit", label: "Edit", icon: <span>·</span> },
  { id: "upgrade", label: "Plan", icon: <span>·</span> },
  { id: "settings", label: "Settings", icon: <span>·</span> },
];

function renderRaised() {
  return renderToStaticMarkup(
    <Tabs items={FIVE} label="Event sections" desktop="rail" mobile="bar" sticky>
      {FIVE.map((item) => (
        <TabPanel key={item.id} id={item.id}>
          {item.label} panel
        </TabPanel>
      ))}
    </Tabs>,
  );
}

describe("the bottom bar on a phone", () => {
  it("is one tablist, not a bar and a strip", () => {
    const html = renderBar();
    expect(html.match(/role="tablist"/g)).toHaveLength(1);
    expect(html.match(/id="share-tab"/g)).toHaveLength(1);
  });

  it("raises one button out of the middle of the row", () => {
    const html = renderRaised();
    const order = (id: string) =>
      new RegExp(`id="${id}-tab"[^>]*class="([^"]*)"`).exec(html)![1];
    expect(order("share")).toContain("max-sm:order-3");
    expect(order("event")).toContain("max-sm:order-1");
    expect(order("edit")).toContain("max-sm:order-2");
    expect(order("upgrade")).toContain("max-sm:order-4");
    expect(order("settings")).toContain("max-sm:order-5");
  });

  it("leaves one shape per width rather than two fighting", () => {
    const html = renderRaised();
    const button = /id="event-tab"[^>]*class="([^"]*)"/.exec(html)![1];
    const classes = button.split(/\s+/);
    for (const pair of [
      ["px-0.5", "px-3.5"],
      ["rounded-lg", "rounded-xl"],
    ]) {
      expect(pair.filter((c) => classes.includes(c))).toHaveLength(1);
    }
  });

  it("shows an icon beside the label once there is room for both", () => {
    const html = renderRaised();
    const button = (id: string) =>
      new RegExp(`id="${id}-tab"(.*?)</button>`, "s").exec(html)![1];
    expect(button("event")).toContain("hidden sm:block");
    expect(button("event")).toContain("text-[1.3125rem] sm:hidden");
    expect(button("share")).toContain("hidden sm:block");
    expect(button("share")).toMatch(/rounded-full[^"]*sm:hidden/);
  });

  it("keeps the full label as the accessible name at every width", () => {
    const html = renderBar();
    expect(html).toContain("Plan and room");
    expect(html).toContain("sr-only sm:not-sr-only");
    expect(html.match(/aria-hidden="true"/g)?.length ?? 0).toBeGreaterThan(1);
  });
});
