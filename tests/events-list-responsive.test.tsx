import { readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EventCard } from "@/components/dashboard/event-card";
import { AccountMenu } from "@/components/layout/account-menu";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { MobileMenu } from "@/components/layout/mobile-menu";
import type { EventRow } from "@/lib/db/types";
import { GB, TIERS } from "@/lib/tiers";

/**
 * The events list on a phone.
 *
 * All four of these are one-word class changes away from coming back, and none
 * of them shows up in a component test that only looks at the copy - the page
 * renders perfectly, a phone just has to scroll sideways to read it.
 */

const root = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

/** Long enough that its untruncated width is wider than any phone. */
const LONG_NAME = "Isidora & Nikola crkveno vencanje, Beograd 2026";

const EVENT = {
  id: "11111111-2222-3333-4444-555555555555",
  owner_id: "00000000-1111-2222-3333-444444444444",
  name: LONG_NAME,
  event_date: "2026-08-30",
  tier: TIERS.pro.id,
  keep_forever: false,
  storage_quota_bytes: 30 * GB,
  storage_used_bytes: 5 * GB,
  expires_at: "2027-08-30T00:00:00.000Z",
  status: "active",
} as unknown as EventRow;

function card() {
  return renderToStaticMarkup(
    <EventCard event={EVENT} photoCount={128} shareLink="https://x.test/e/a" />,
  );
}

describe("the events list at phone widths", () => {
  it("declares a base column, so the grid is never sized by the widest event name", () => {
    // A bare `grid` places the cards in an *implicit* column, and an implicit
    // column is `auto` - its minimum is the item's min-content width. The event
    // name sets `white-space: nowrap` to earn its ellipsis, so min-content is
    // the whole untruncated name, and the track grew to fit it: every card came
    // out 524px wide on a 320px phone. `grid-cols-1` is
    // `repeat(1, minmax(0, 1fr))`, and that 0 is what caps the track.
    const source = read("src/app/dashboard/(shell)/page.tsx");
    const list = source.match(/<ul className="([^"]+)"/)?.[1] ?? "";

    expect(list).toContain("grid");
    expect(list).toContain("grid-cols-1");
  });

  it("keeps the card itself from widening whatever track it is put in", () => {
    // The other half of the same rule: a grid item's own `min-width` is `auto`,
    // which resolves to its content-based minimum. Capping the track is not
    // enough on its own - the card has to agree to be narrower than its text.
    const html = card();
    const li = html.match(/<li class="([^"]+)"/)?.[1] ?? "";

    expect(li).toContain("min-w-0");
    // And the name still earns its ellipsis rather than wrapping the card open.
    expect(html).toContain("truncate");
  });

  it("hangs the phone menu off the header, edges flush with the bar", () => {
    // The panel is `absolute ... top-full`, so it needs a positioned ancestor.
    // Without one, `top: 100%` means 100% of the *viewport*: tapping the
    // hamburger opened the menu one whole screen further down the page, which
    // reads as the button doing nothing at all. The header is that ancestor -
    // both callers position it - and an inset is measured from its padding
    // box, which is the page gutter, so `inset-x-0` lands the panel's edges on
    // the bar's own. Anchored to the icon instead, it sat 12px to the left.
    const source = read("src/components/layout/mobile-menu.tsx");
    expect(source).toContain("absolute inset-x-0 top-full");
    // The wrapper must NOT be positioned, or the inset resolves against the
    // icon's 44px box again.
    expect(source).toContain('cx("flex items-center", className)');
    expect(read("src/components/layout/site-header.tsx")).toContain(
      'HeaderShell className="sticky top-0 z-40"',
    );
    expect(read("src/components/layout/dashboard-header.tsx")).toContain(
      'HeaderShell className="relative z-10"',
    );

    const html = renderToStaticMarkup(
      <DashboardHeader name="Nikola" email="n@example.com" avatarUrl={null} />,
    );
    const outer = html.match(/^<div class="([^"]+)"/)?.[1] ?? "";

    expect(outer).toContain("relative");
  });

  it("opens the account panel towards the room it has", () => {
    // The panel is `w-64` and anchored to one edge of a 40px badge. Anchor it to
    // the right of a badge that sits at the *start* of a row and 188px of it is
    // off the left of the screen - which is what the phone menu used to do to
    // sign out. Both anchors have to stay reachable from the outside.
    const source = read("src/components/layout/account-menu.tsx");
    expect(source).toContain('align === "left" ? "left-0" : "right-0"');

    // Rendering both proves the prop is accepted; the panel itself is only in
    // the markup once it is open, which needs a click this runner has no DOM for.
    for (const align of ["left", "right"] as const) {
      expect(
        renderToStaticMarkup(
          <AccountMenu
            name="Nikola"
            email="n@example.com"
            avatarUrl={null}
            align={align}
          />,
        ),
      ).toContain("Account: Nikola");
    }
  });

  it("puts every action behind one hamburger on a phone", () => {
    // The dashboard has three of them - the account, "My events" and "New
    // event" - and all three used to sit on the bar at once, filling the pill
    // edge to edge with no menu in sight.
    const html = renderToStaticMarkup(
      <DashboardHeader name="Nikola" email="n@example.com" avatarUrl={null} />,
    );

    expect(html).toContain("Open menu");
    // The row they came from is the desktop one now, not the phone's.
    expect(html).toContain("hidden min-w-0 items-center gap-4 sm:flex");
  });

  it("drops the hamburger when it would hold a single item", () => {
    // A menu holding one thing is a tap in front of the thing. The rule lives
    // in MobileMenu, so it is the same rule on every header that has one.
    const one = renderToStaticMarkup(
      <MobileMenu
        items={[{ key: "a", render: () => <span>Only one</span> }]}
      />,
    );

    expect(one).toContain("Only one");
    expect(one).not.toContain("Open menu");

    const two = renderToStaticMarkup(
      <MobileMenu
        items={[
          { key: "a", render: () => <span>First</span> },
          { key: "b", render: () => <span>Second</span> },
        ]}
      />,
    );

    expect(two).toContain("Open menu");
    // Closed, the items are the menu's business and not the bar's.
    expect(two).not.toContain("First");
  });

  it("keeps the panel's items in the order they were given", () => {
    // Closed is the only state a string render sees on its own, so the panel
    // is asked to start open here.
    const html = renderToStaticMarkup(
      <MobileMenu
        defaultOpen
        items={[
          { key: "a", render: () => <span>Account</span> },
          { key: "b", render: () => <span>Links</span> },
          { key: "c", render: () => <span>Call to action</span> },
        ]}
      />,
    );

    expect(html.indexOf("Account")).toBeLessThan(html.indexOf("Links"));
    expect(html.indexOf("Links")).toBeLessThan(html.indexOf("Call to action"));
    // Open, the icon is the way back out.
    expect(html).toContain("Close menu");
  });

  it("gives the phone menu the bar's own surface, not a white card", () => {
    // Same paper, same 92%, same blur, so the menu reads as the bar carrying
    // on rather than as a card dropped over it.
    const source = read("src/components/layout/mobile-menu.tsx");

    expect(source).toContain("bg-paper/92");
    expect(source).toContain("backdrop-blur");
    // And a gap between the two, rather than the panel touching the bar.
    expect(source).toContain("mt-2");
  });

  it("sets the phone menu to the right, under the icon that opened it", () => {
    // The hamburger is at the right end of the bar. A list running down the
    // left of the screen underneath it reads as belonging to something else.
    const source = read("src/components/layout/mobile-menu.tsx");

    expect(source).toContain("items-end");
    expect(source).toMatch(/flex-col items-end[^"]*text-right/);
    expect(source).toContain('cx("flex w-full justify-end", item.className)');
  });

  it("keeps who is signed in reachable at both widths", () => {
    // On the bar from `sm` up, and inside the hamburger below it - never
    // nowhere, or signing out would need a laptop.
    const html = renderToStaticMarkup(
      <DashboardHeader
        name="Nikola Mirilo"
        email="n@example.com"
        avatarUrl={null}
      />,
    );

    expect(html).toContain("Nikola Mirilo");
    expect(html).toContain("Open menu");

    const source = read("src/components/layout/dashboard-header.tsx");
    // The account is the first thing in the phone menu, above the links.
    expect(source).toContain('key: "account"');
  });
});
