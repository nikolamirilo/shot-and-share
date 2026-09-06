import {
  PlatformFooterA,
  PlatformFooterB,
  PlatformFooterC,
  PlatformHeaderA,
  PlatformHeaderB,
  PlatformHeaderC,
} from "@/components/layout/platform-banner-variants";
import { PlatformInviteBar } from "@/components/layout/platform-invite-bar";
import {
  PlatformFooter,
  PlatformHeader,
} from "@/components/layout/platform-banner";
import { PhotoPlaceholder } from "@/components/ui";

/**
 * Scratch page for eyeballing the free-event header and footer variants
 * against what is live. Delete with the two variants that lose.
 *
 * Each block is a stand-in for a free event page: the bar, a cover, a few
 * frames, then the footer. The middle is deliberately dull - the thing being
 * judged is what sits above and below somebody else's photographs.
 */
export default function DevBanners() {
  return (
    <main className="bg-linen">
      <Block
        name="Live today"
        note="Blush band, one line of copy, one button."
        header={<PlatformHeader />}
        footer={<PlatformFooter />}
      />
      <Block
        name="A · Bar & Band"
        note="Same strip on top, claret closing band at the bottom."
        header={<PlatformHeaderA />}
        footer={<PlatformFooterA />}
      />
      <Block
        name="B · The receipt"
        note="No CTA in the header; the footer explains how the photos got here."
        header={<PlatformHeaderB />}
        footer={<PlatformFooterB />}
      />
      <Block
        name="C · Sticky invite"
        note="Mark only on top, short dark footer, and the bar pinned at the bottom of this window."
        header={<PlatformHeaderC />}
        footer={<PlatformFooterC />}
      />

      {/* Only one of these can be on screen at a time, so the bar is mounted
          once for the page rather than per block. Scroll past halfway. */}
      <PlatformInviteBar />
    </main>
  );
}

function Block({
  name,
  note,
  header,
  footer,
}: {
  name: string;
  note: string;
  header: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <p className="eyebrow">{name}</p>
      <p className="mb-4 mt-1 text-label text-ash">{note}</p>

      <div className="overflow-hidden rounded-card bg-linen shadow-lg">
        {header}

        <div className="bg-blush px-4 py-10 text-center">
          <p className="eyebrow">Saturday, 12 July</p>
          <h1 className="mt-2 text-h2">Ana &amp; Marko</h1>
        </div>

        <div className="grid grid-cols-3 gap-2 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <PhotoPlaceholder key={i} className="aspect-square" />
          ))}
        </div>

        {footer}
      </div>
    </section>
  );
}
