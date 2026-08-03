import type { Metadata } from "next";
import Link from "next/link";

import { PricingTable } from "@/components/pricing-table";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Slab } from "@/components/slab";
import { Badge, ButtonLink, Eyebrow, Hole } from "@/components/ui";
import { getSessionUser } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";

export const metadata: Metadata = {
  title: "Say Cheese — every photo from every guest, at any event",
};

export default async function LandingPage() {
  const user = hasSupabase ? await getSessionUser() : null;

  return (
    <>
      <SiteHeader signedIn={Boolean(user)} />
      <main>
        <Hero signedIn={Boolean(user)} />
        <Strip />
        <Steps />
        <Why />
        <Pricing />
        <Faq />
        <Close signedIn={Boolean(user)} />
      </main>
      <SiteFooter />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="bg-butter">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:py-20">
        <div className="rise">
          <Eyebrow>Photo collection for events</Eyebrow>

          {/* A fact, not a slogan. Most hosts genuinely see a tiny fraction of
              the photos taken at their own event, and saying so plainly does
              more work than any tagline would. */}
          <h1 className="mt-4 text-[2.75rem] leading-[0.98] sm:text-[4rem] lg:text-[5.5rem]">
            Two hundred guests took two thousand photos.
            <br />
            <span className="text-rind">You saw fifty.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lead">
            Guests scan a code on the table and hand you their photos. No app, no
            account, nothing to install. It takes them about twenty seconds.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ButtonLink
              href={signedIn ? "/dashboard" : "/login"}
              size="lg"
              variant="primary"
            >
              Create an event
            </ButtonLink>
            <ButtonLink href="/pricing" size="lg" variant="secondary">
              See pricing
            </ButtonLink>
          </div>

          <p className="mt-5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
            Free plan · 250 photos · clean QR code · no card
          </p>
        </div>

        <div className="lg:pl-4">
          <Slab />
        </div>
      </div>
    </section>
  );
}

/**
 * The only break between the yellows. It exists so the Butter hero and the
 * Gouda band underneath do not blur into each other.
 */
function Strip() {
  const facts = [
    ["No app", "Opens in the phone's browser"],
    ["No account", "Guests never sign in"],
    ["No hunting", "Everything in one gallery"],
  ];

  return (
    <section className="border-y-2 border-pepper bg-pepper text-butter">
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 sm:grid-cols-3">
        {facts.map(([title, detail]) => (
          <div key={title} className="flex items-start gap-3">
            <Hole size={14} className="mt-1.5" />
            <div>
              <p className="font-display text-[1.3rem] font-extrabold tracking-[-0.03em]">
                {title}
              </p>
              <p className="text-[0.9375rem] text-butter/70">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Steps() {
  const steps = [
    {
      n: "01",
      title: "Create the event",
      body: "Name it, pick the date. You get a link and a printable QR card straight away, before you pay anything.",
    },
    {
      n: "02",
      title: "Put the code on the tables",
      body: "Print it, drop it in the group chat, or put it on the order of service. Guests point a camera at it — that is the whole instruction.",
    },
    {
      n: "03",
      title: "Keep everything",
      body: "Photos land in one gallery as they arrive. Download the lot as a single ZIP the morning after.",
    },
  ];

  return (
    <section id="how" className="border-b-2 border-pepper bg-gouda">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
        <Eyebrow className="text-crust">How it works</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-h1 sm:text-[4rem]">
          Three things to do, and one of them is printing.
        </h2>

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <li
              key={step.n}
              className="rounded-[1.25rem] border-2 border-pepper bg-cream p-6"
            >
              <span className="hole inline-flex h-12 w-12 items-center justify-center font-mono text-[0.8125rem] tracking-[0.1em] text-gouda-light">
                {step.n}
              </span>
              <h3 className="mt-4 text-h3">{step.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-crust">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Why() {
  const items = [
    {
      title: "The guest side is one screen",
      body: "Open, choose photos, done. Every sign-in prompt is a guest who does not upload, so there are none.",
    },
    {
      title: "Gigabytes, not photo counts",
      body: "A photo limit punishes anyone with a recent phone. We count storage, which is what actually costs money, and it lets us be far more generous.",
    },
    {
      title: "Nothing is deleted quietly",
      body: "Warnings go out at 14, 7 and 1 days. After that the event is paused, not erased, and stays restorable for two more weeks.",
    },
    {
      title: "Keep them forever for €29, once",
      body: "Not a subscription. People plan one wedding, not twelve, and asking them to remember to cancel something afterwards is a bad experience.",
    },
    {
      title: "You can shut the link off",
      body: "If a link ends up somewhere it should not be, revoke it. It stops working immediately and you can issue a new one.",
    },
    {
      title: "Live slideshow on the night",
      body: "Point a laptop at the projector and photos appear as guests upload them. On the Wheel plan, no venue software needed.",
    },
  ];

  return (
    <section className="border-b-2 border-pepper bg-butter">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
        <Eyebrow>Why this one</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-h1">
          Built for the person who has to collect them afterwards.
        </h2>

        <div className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.title}>
              <div className="flex items-center gap-3">
                <Hole size={13} />
                <h3 className="text-[1.3rem] font-extrabold tracking-[-0.03em]">
                  {item.title}
                </h3>
              </div>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-crust">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="border-b-2 border-pepper bg-butter">
      <div className="mx-auto max-w-6xl px-5 pb-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-3 text-h1">Paid once, per event.</h2>
            <p className="mt-3 max-w-xl text-body text-crust">
              No subscription. Buy the size you need for the day, and add The
              Cellar later if you want the photos kept permanently.
            </p>
          </div>
          <Badge tone="outline">VAT handled at checkout</Badge>
        </div>

        <div className="mt-10">
          <PricingTable />
        </div>

        <p className="mt-6 text-[0.9375rem] text-crust">
          Wedding photographer running fifteen events a year?{" "}
          <Link href="mailto:hello@saycheese.app" className="underline">
            Talk to us
          </Link>{" "}
          — a plan for you is next.
        </p>
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    [
      "Do guests need an account?",
      "No. They open the link, choose photos and upload. There is no sign-in prompt anywhere on the guest side, on purpose — it is the single biggest reason people fail to hand over their photos.",
    ],
    [
      "What happens when the storage window ends?",
      "You get emails 14, 7 and 1 days before. When it ends the event is paused rather than deleted, and stays restorable for another 14 days. Add The Cellar at any point and nothing is ever removed.",
    ],
    [
      "Can I stop people uploading?",
      "Yes. Revoke the link from your dashboard and it stops working immediately. You can issue a fresh one for the people who should still have it.",
    ],
    [
      "How many photos actually fit?",
      "Slice holds about 2,500 and Wheel about 7,500, based on a 4 MB photo. Modern phones vary, which is exactly why the limit is in gigabytes rather than a photo count.",
    ],
    [
      "Can guests see the photos everyone else uploaded?",
      "That is your choice per event. The shared gallery is on by default because guests like seeing the night from other people's phones, and you can turn it off.",
    ],
    [
      "Is video included?",
      "On the paid plans, up to 200 MB a clip. The free plan is photos only: one large video can eat the entire free allowance, which would make the free plan useless for what it is meant to prove.",
    ],
  ];

  return (
    <section id="faq" className="border-b-2 border-pepper bg-butter">
      <div className="mx-auto max-w-3xl px-5 pb-20">
        <Eyebrow>Questions</Eyebrow>
        <h2 className="mt-3 text-h1">Before you ask.</h2>

        <div className="mt-10 divide-y-2 divide-pepper/15 border-y-2 border-pepper/15">
          {faqs.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start gap-3 text-[1.3rem] font-extrabold tracking-[-0.03em] marker:hidden">
                <Hole
                  size={13}
                  className="mt-2 transition-transform group-open:scale-150"
                />
                {q}
              </summary>
              <p className="mt-3 pl-6 text-[0.9375rem] leading-relaxed text-crust">
                {a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Close({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="bg-gouda">
      <div className="mx-auto max-w-3xl px-5 py-20 text-center lg:py-28">
        <h2 className="text-h1 sm:text-[4rem]">
          Set it up tonight. It costs nothing to try.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lead text-crust">
          Make the event, print the code, send the link to one friend and watch
          a photo arrive. Then decide whether to pay.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <ButtonLink
            href={signedIn ? "/dashboard" : "/login"}
            size="lg"
            variant="primary"
          >
            Create an event
          </ButtonLink>
          <ButtonLink href="/pricing" size="lg" variant="secondary">
            Compare the plans
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
