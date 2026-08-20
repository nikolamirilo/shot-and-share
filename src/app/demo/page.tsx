import type { Metadata } from "next";
import Link from "next/link";
import { MdOutlineAddCircleOutline, MdOutlineQrCode2 } from "react-icons/md";

import { DemoGallery } from "@/components/demo/demo-gallery";
import { EventCover, EventThemeRoot } from "@/components/event/event-cover";
import { SiteFooter } from "@/components/layout/site-footer";
import { UploadPanel } from "@/components/upload/upload-panel";
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

/**
 * What a guest sees, openable by anybody.
 *
 * Every call to action on this site went to /login, which means the first thing
 * a stranger meets is a sign-in form. That is a poor trade with customers and a
 * worse one with anybody assessing the business, who will not create an account
 * to find out what is being sold.
 *
 * Built from the guest page's own components rather than screenshots or a
 * mock-up, so it is the product rather than a picture of it, and so it cannot
 * rot into a description of something the product used to do.
 *
 * The one thing that does not work is uploading, because there is no event
 * behind this page to upload into. The panel is rendered in the same inert
 * preview mode the host's own dashboard uses, and the page says so plainly
 * rather than offering a button that quietly does nothing.
 */
export default function DemoPage() {
  const palette = THEMES[0].palette;

  return (
    <>
      <EventThemeRoot palette={palette} className="min-h-dvh">
        {/* Said before anything else, and never dressed up as part of the
            event. A demo that does not announce itself is a fake gallery. */}
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
          date={DEMO_EVENT.date}
          message={DEMO_EVENT.message}
          coverUrl={DEMO_MEDIA[0].fullUrl}
          palette={palette}
        />

        <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-5 sm:pb-20 sm:pt-8">
          {/* The real panel at its real size, made inert by the wrapper rather
              than by the component's `preview` mode.
              
              `preview` exists for the host's dashboard thumbnail, so it shrinks
              the type and drops the consent line beneath the button. That line
              is one of the things somebody assessing this product most wants to
              see, so the demo shows the control exactly as a guest meets it and
              only takes away the ability to press it. */}
          <div aria-hidden inert className="pointer-events-none opacity-90">
            <UploadPanel
              variant="button"
              label="Add your photos"
              hint="Photos and video, straight from your camera roll."
            />
          </div>
          <p className="mt-3 text-center text-[0.9375rem] text-ash">
            Uploading is the one thing switched off here, because there is no
            real event behind this page.{" "}
            <Link href="/login" className="underline underline-offset-2">
              Create a free event
            </Link>{" "}
            and the same button works from any phone.
          </p>

          <DemoGallery />

          <div className="mt-12 rounded-[1.25rem] bg-paper p-5 shadow-md sm:mt-16 sm:p-6">
            <h2 className="text-h3">How your guests get here</h2>
            <ol className="mt-3 space-y-2 text-[0.9375rem] text-ash">
              <li>1. You create an event and print the QR code.</li>
              <li>2. A guest scans it and lands on a page like this one.</li>
              <li>3. They upload. No app, no account, no name.</li>
            </ol>

            <div className="mt-5 flex flex-wrap gap-2.5 sm:gap-3">
              <ButtonLink href="/login" size="lg">
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
