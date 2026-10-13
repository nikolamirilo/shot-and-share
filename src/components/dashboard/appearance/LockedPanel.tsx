"use client";

import { useContext } from "react";
import { MdOutlineWorkspacePremium } from "react-icons/md";

import { Badge, Button, ButtonLink } from "@/components/ui";
import { TabsContext } from "@/components/ui/tabs/context";
import { TIERS } from "@/lib/tiers";

export function LockedPanel({ eventId }: { eventId: string }) {
  const tabs = useContext(TabsContext);

  const label = (
    <>
      <MdOutlineWorkspacePremium aria-hidden className="shrink-0 text-[1.25em]" />
      See the plans
    </>
  );

  return (
    <section className="card p-6">
      <Badge tone="outline">Not available on {TIERS.free.name} plan</Badge>

      <h2 className="mt-3 text-h3">
        Switch to {TIERS.plus.name} or {TIERS.pro.name}
      </h2>

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
