import { Badge, ButtonLink } from "@/components/ui";

export function LockedPanel({ eventId }: { eventId: string }) {
  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3">The event page</h2>
        <Badge tone="outline">Slice and Wheel</Badge>
      </div>

      <p className="mt-3 text-[0.9375rem] leading-relaxed text-crust">
        On the free plan your guests see the Say Cheese theme, a fixed cover and
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
          "No Say Cheese header or footer",
        ].map((line) => (
          <li key={line} className="flex items-start gap-2.5">
            <span className="hole mt-2 h-2.5 w-2.5 shrink-0" />
            <span className="text-[0.9375rem] leading-snug">{line}</span>
          </li>
        ))}
      </ul>

      <ButtonLink href={`/dashboard/events/${eventId}#upgrade`} className="mt-5">
        See the plans
      </ButtonLink>
    </section>
  );
}
