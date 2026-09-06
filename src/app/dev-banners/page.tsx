import {
  type BannerVariant,
  VARIANTS,
} from "@/components/layout/platform-banner-variants";
import {
  PlatformFooter,
  PlatformHeader,
} from "@/components/layout/platform-banner";
import { PlatformInviteBar } from "@/components/layout/platform-invite-bar";
import { PhotoPlaceholder } from "@/components/ui";

/**
 * Scratch page for eyeballing the free-event header and footer candidates
 * against what is live. Delete it with the nine that lose.
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

      {VARIANTS.map((variant) => (
        <VariantBlock key={variant.key} variant={variant} />
      ))}

      {/* Belongs to 10, and pairs with any of the others. Mounted once for the
          page rather than per block; scroll past halfway. */}
      <PlatformInviteBar />
    </main>
  );
}

function VariantBlock({ variant }: { variant: BannerVariant }) {
  const { Header, Footer } = variant;
  return (
    <Block
      name={variant.name}
      note={variant.note}
      header={<Header />}
      footer={<Footer />}
    />
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
