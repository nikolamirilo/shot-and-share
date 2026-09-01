import { readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EventCard } from "@/components/dashboard/event-card";
import { AccountMenu } from "@/components/layout/account-menu";
import { DashboardHeader } from "@/components/layout/dashboard-header";
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

  it("hangs the phone menu off the header rather than off the viewport", () => {
    // The panel is `absolute ... top-full`. When the header and the panel were
    // siblings in a fragment there was no positioned ancestor for that to
    // resolve against, so `top: 100%` meant 100% of the *viewport*: tapping the
    // hamburger opened the menu one whole screen further down the page, which
    // reads as the button doing nothing at all.
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

  it("puts the last menu item on the bar instead of behind a hamburger", () => {
    // One item behind a hamburger is a tap in front of the thing. The rule is
    // driven by NAV's length, so this is what fails if a second item is added
    // without the folded-away branch being checked.
    const html = renderToStaticMarkup(
      <DashboardHeader name="Nikola" email="n@example.com" avatarUrl={null} />,
    );

    expect(html).toContain("My events");
    expect(html).not.toContain("Open menu");
  });

  it("folds back into a hamburger, set to the right, once there are two", () => {
    // The branch today's single item never reaches. It is checked at the source
    // because NAV is a module constant, so there is no way to render the other
    // side of it - which is exactly why it is worth pinning down.
    const source = read("src/components/layout/dashboard-header.tsx");

    expect(source).toContain("const collapsed = NAV.length <= 1;");
    // Both the hamburger and the panel it opens are gated on the same flag.
    expect(source).toContain("{!collapsed && (");
    expect(source).toContain("{!collapsed && menuOpen && (");
    // And everything inside the panel is set to the right, under the button.
    expect(source).toMatch(/flex-col items-end[^"]*text-right/);
    expect(source).toContain("flex flex-col items-end gap-1");
  });

  it("shows who is signed in on the bar, not just a circle of initials", () => {
    // With no hamburger there is no panel for the account to live in, so the
    // badge is the only sign of who is signed in on a phone - and it carries
    // the name from `xs` up rather than two letters at every width.
    const html = renderToStaticMarkup(
      <DashboardHeader
        name="Nikola Mirilo"
        email="n@example.com"
        avatarUrl={null}
      />,
    );

    expect(html).toContain("Nikola Mirilo");
    // Never `hidden sm:block`: that was the desktop-only wrapper, and it would
    // take sign out off the phone entirely now that the menu is gone.
    expect(html).not.toContain("hidden sm:block");
  });
});
