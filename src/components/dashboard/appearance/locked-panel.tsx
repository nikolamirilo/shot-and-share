"use client";

import { useContext } from "react";
import { MdOutlineWorkspacePremium } from "react-icons/md";

import { Badge, Button, ButtonLink } from "@/components/ui";
import { TabsContext } from "@/components/ui/tabs/context";
import { TIERS } from "@/lib/tiers";

export function LockedPanel({ eventId }: { eventId: string }) {
  /*
   * On the event console this panel sits in a tab beside the one it is sending
   * the host to, so it opens that tab itself. The link is the fallback for
   * anywhere else this ends up - and the reason it is only the fallback is
   * that it does nothing at all from a page that is already open: the router
   * moves a same-page hash with `history.pushState`, which fires no
   * `hashchange` for the tabs to hear.
   */
  const tabs = useContext(TabsContext);

  const label = (
    <>
      <MdOutlineWorkspacePremium aria-hidden className="shrink-0 text-[1.25em]" />
      See the plans
    </>
  );

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3">The event page</h2>
        <Badge tone="outline">
          {TIERS.plus.name} and {TIERS.pro.name}
        </Badge>
      </div>

      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ash">
        On the free plan your guests see the Shot & Share theme, a fixed cover and
        a fixed gallery, with a small header and footer pointing back to us.
        Everything works - it just looks like ours rather than yours.
      </p>

      <ul className="mt-4 space-y-2">
        {[
          "Six themes, or pick your own colours",
          "Five type pairings, from formal to loud",
          "Four cover styles, including a full-screen photo",
          "Four ways to ask your guests for photos",
          "Choose how the gallery is laid out",
          "No Shot & Share header or footer",
        ].map((line) => (
          <li key={line} className="flex items-start gap-2.5">
            <span className="hole mt-2 h-2.5 w-2.5 shrink-0" />
            <span className="text-[0.9375rem] leading-snug">{line}</span>
          </li>
        ))}
      </ul>

      {tabs ? (
        <Button onClick={() => tabs.open("upgrade")} className="mt-5">
          {label}
        </Button>
      ) : (
        <ButtonLink href={`/dashboard/events/${eventId}#upgrade`} className="mt-5">
          {label}
        </ButtonLink>
      )}
    </section>
  );
}
