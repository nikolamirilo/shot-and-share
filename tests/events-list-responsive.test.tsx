import { readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EventCard } from "@/components/dashboard/EventCard";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { type EventRow } from "@/types/db";
import { GB, TIERS } from "@/lib/tiers";

const root = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

const LONG_NAME = "Isidora & Nikola crkveno vencanje, Beograd 2026";

const HOST = { name: "Nikola", email: "n@example.com", avatarUrl: null };

const EVENT = {
  id: "11111111-2222-3333-4444-555555555555",
  owner_id: "00000000-1111-2222-3333-444444444444",
  name: LONG_NAME,
  retention_from: "2026-08-30T00:00:00.000Z",
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
    const source = read("src/app/dashboard/(shell)/page.tsx");
    const list = source.match(/<ul className="([^"]+)"/)?.[1] ?? "";

    expect(list).toContain("grid");
    expect(list).toContain("grid-cols-1");
  });

  it("keeps the card itself from widening whatever track it is put in", () => {
    const html = card();
    const li = html.match(/<li class="([^"]+)"/)?.[1] ?? "";

    expect(li).toContain("min-w-0");
    expect(html).toContain("truncate");
  });

  it("hangs the phone menu off the header, edges flush with the bar", () => {
    const source = read("src/components/layout/MobileMenu.tsx");
    expect(source).toContain("absolute inset-x-0 top-full");
    expect(source).toContain('cx("flex items-center", className)');
    expect(read("src/components/layout/SiteHeader.tsx")).toContain(
      'HeaderShell className="sticky top-0 z-40"',
    );

    const html = renderToStaticMarkup(<SiteHeader user={HOST} />);
    const bar = html.match(/^<header class="([^"]+)"/)?.[1] ?? "";

    expect(bar).toContain("sticky");
  });

  it("opens the account panel towards the room it has", () => {
    const source = read("src/components/layout/AccountMenu.tsx");
    expect(source).toContain('align === "left" ? "left-0" : "right-0"');

    // The panel is only in the markup once it is open, which needs a click this runner
    // has no DOM for - so this only proves the prop is accepted.
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
    const html = renderToStaticMarkup(<SiteHeader user={HOST} />);

    expect(html).toContain("Open menu");
    expect(html).toContain("hidden min-w-0 items-center gap-5 md:flex");
  });

  it("drops the hamburger when it would hold a single item", () => {
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
    expect(two).not.toContain("First");
  });

  it("keeps the panel's items in the order they were given", () => {
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
    expect(html).toContain("Close menu");
  });

  it("gives the phone menu the bar's paper at full strength", () => {
    const source = read("src/components/layout/MobileMenu.tsx");

    expect(source).toContain("bg-paper ");
    expect(source).not.toContain("bg-paper/");
    expect(source).not.toContain("backdrop-blur");
    expect(source).toContain("mt-2");
  });

  it("puts the wordmark and the hamburger on the same two edges", () => {
    expect(read("src/components/layout/SiteHeader.tsx")).toContain(
      'className="flex shrink-0 items-center"',
    );

    expect(read("src/components/layout/MobileMenu.tsx")).toContain(
      "-mr-2.5 flex h-11 w-11",
    );
  });

  it("sets the phone menu to the right, under the icon that opened it", () => {
    const source = read("src/components/layout/MobileMenu.tsx");

    expect(source).toContain("items-end");
    expect(source).toMatch(/flex-col items-end[^"]*text-right/);
    expect(source).toContain('cx("flex w-full justify-end", item.className)');
  });

  it("keeps who is signed in reachable at both widths", () => {
    const html = renderToStaticMarkup(
      <SiteHeader user={{ ...HOST, name: "Nikola Mirilo" }} />,
    );

    expect(html).toContain("Nikola Mirilo");
    expect(html).toContain("Open menu");

    const source = read("src/components/layout/SiteHeader.tsx");
    expect(source).toContain('key: "account"');
  });
});
