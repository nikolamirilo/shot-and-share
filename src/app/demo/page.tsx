import type { Metadata } from "next";
import Link from "next/link";
import { MdOutlineAddCircleOutline, MdOutlineQrCode2 } from "react-icons/md";

import { DemoStage } from "@/components/demo/DemoStage";
import { EventCover, EventThemeRoot } from "@/components/event/EventCover";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ButtonLink } from "@/components/ui";
import { THEMES } from "@/lib/appearance/themes";
import { DEMO_EVENT, DEMO_MEDIA } from "@/lib/demo";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "See a real gallery",
  description:
    "The guest page, exactly as it looks at an event. No sign-up, no app, nothing to install - open it and scroll.",
  alternates: { canonical: "/demo" },
};

export default function DemoPage() {
  const palette = THEMES[0].palette;

  return (
    <>
      <EventThemeRoot palette={palette} className="min-h-dvh">
        <div className="bg-ink text-linen">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
            <p className="text-[0.9375rem]">
              <strong>This is a demo.</strong> It is the page your guests open,
              with photos already in it.
            </p>
            <Link
              href="/"
              className="text-[0.9375rem] text-linen/75 underline underline-offset-2 hover:text-linen"
            >
              {SITE.name}
            </Link>
          </div>
        </div>

        <EventCover
          variant="classic"
          name={DEMO_EVENT.name}
          message={DEMO_EVENT.message}
          coverUrl={DEMO_MEDIA[0].fullUrl}
          palette={palette}
        />

        <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-5 sm:pb-20 sm:pt-8">
          <DemoStage />

          <div className="mt-12 rounded-[1.25rem] bg-paper p-5 shadow-md sm:mt-16 sm:p-6">
            <h2 className="text-h3">How your guests get here</h2>
            <ol className="mt-3 space-y-2 text-[0.9375rem] text-ash">
              <li>1. You create an event and print the QR code.</li>
              <li>2. A guest scans it and lands on a page like this one.</li>
              <li>3. They upload. No app, no account, no name.</li>
            </ol>

            <div className="mt-5 flex flex-wrap gap-2.5 sm:gap-3">
              <ButtonLink href="/signup" size="lg">
                <MdOutlineAddCircleOutline
                  aria-hidden
                  className="shrink-0 text-[1.25em]"
                />
                Create an event
              </ButtonLink>
              <ButtonLink href="/pricing" variant="secondary" size="lg">
                <MdOutlineQrCode2 aria-hidden className="shrink-0 text-[1.25em]" />
                See pricing
              </ButtonLink>
            </div>
          </div>
        </main>
      </EventThemeRoot>

      <SiteFooter />
    </>
  );
}
