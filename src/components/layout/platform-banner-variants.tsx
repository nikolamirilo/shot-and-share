import Link from "next/link";
import { MdOutlineAddCircleOutline } from "react-icons/md";

import { LogoMark, Wordmark } from "@/components/layout/logo";
import { ButtonLink, Hole, PhotoPlaceholder } from "@/components/ui";
import { TIERS, photoCountLabel } from "@/lib/tiers";

/**
 * Ten candidate header/footer pairs for a free event page, side by side at
 * /dev-banners. One of them replaces `platform-banner.tsx`; the rest get
 * deleted with that page.
 *
 * They are all built out of parts the product already has, because the first
 * attempt was three adverts in the house colours - a black strip over the
 * host's cover, a full-bleed claret band under it - and it read as exactly
 * that. The system's own rules, which none of these break:
 *
 * - Nothing is outlined. A thing is separate because it floats, or because the
 *   ground steps down a shade, the way the site footer's colophon does.
 * - The only dark surface is a well, and a well is where a photograph goes.
 *   Ink is for type, not for a bar across somebody's cover.
 * - Claret is spent once, on the thing you press.
 * - Everything reads the theme variables, so any of these follows a themed
 *   page if free events ever get one.
 *
 * And the argument they share: the header stays out of the way (a guest came
 * to upload, not to shop), the pitch waits for the bottom, and the price is
 * the pitch - quoted from `TIERS.free` so it cannot drift from the pricing
 * page.
 */

/** The free plan in the four words a footer has room for. Never hand-typed. */
const FREE_FACTS = [
  "Free",
  `${photoCountLabel(TIERS.free.quotaBytes)} photos`,
  `${TIERS.free.retentionDays} days`,
  "no app",
].join(" · ");

const HOME = { href: "/", target: "_blank", rel: "noopener" } as const;

/* --- shared parts ---------------------------------------------------------- */

/**
 * The house's own floating bar, borrowed from `HeaderShell`: paper at 92%, a
 * soft shadow, blurred behind, on the page's gutter. It is how the marketing
 * site says "we are here" on every page, and the one shape that is
 * unmistakably ours without taking anything from the host.
 */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 sm:px-5 sm:pt-4">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl bg-paper/92 px-3.5 py-2 shadow-sm backdrop-blur sm:px-4 sm:py-2.5">
        {children}
      </div>
    </div>
  );
}

function MarkLabel() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className="h-5 w-auto" />
      <span className="eyebrow">Shot &amp; Share</span>
    </span>
  );
}

/** A claret text link. The second choice everywhere a button is the first. */
function TextLink({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      {...HOME}
      className={`inline-flex min-h-11 items-center gap-2 font-semibold text-claret underline decoration-2 decoration-claret/40 underline-offset-4 hover:decoration-claret ${className}`}
    >
      {children}
    </Link>
  );
}

/** A run of holes at film-edge size. Perforation, and the house's signature. */
function Perforation({ count = 12 }: { count?: number }) {
  return (
    <div
      aria-hidden
      className="flex items-center justify-center gap-2 overflow-hidden"
    >
      {Array.from({ length: count }, (_, i) => (
        <Hole key={i} size={9} />
      ))}
    </div>
  );
}

/* --- 01 · Pill & Card ------------------------------------------------------
   One object language, top and bottom: the site's pill over the cover, and the
   same paper floating again at the end as a card. Nothing full-bleed, nothing
   dark, no rules - the two things that are ours are the two that float.
   --------------------------------------------------------------------------- */

function HeaderPillCard() {
  return (
    <Pill>
      <Link {...HOME} className="min-w-0">
        <MarkLabel />
      </Link>
      <Link
        {...HOME}
        className="shrink-0 font-mono text-micro uppercase tracking-[0.14em] text-claret underline decoration-claret/35 underline-offset-4 hover:decoration-claret"
      >
        Free for your event
      </Link>
    </Pill>
  );
}

function FooterPillCard() {
  return (
    <section className="px-4 pb-10 sm:px-5 sm:pb-12">
      <div className="card mx-auto max-w-3xl px-6 py-8 text-center sm:px-8 sm:py-10">
        <LogoMark className="mx-auto h-7 w-auto" />
        <h2 className="mt-4 text-h3 sm:text-h2">
          Your event can have one of these.
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-small leading-relaxed text-ash">
          One code on the table, and every photo your guests take lands in one
          place. Nothing for them to install.
        </p>
        <ButtonLink {...HOME} size="lg" className="mt-6 w-full sm:w-auto">
          <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
          Create your free event
        </ButtonLink>
        <p className="eyebrow mt-4">{FREE_FACTS}</p>
      </div>
    </section>
  );
}

/* --- 02 · One more frame ---------------------------------------------------
   The gallery does not stop, it runs out of photographs: the last frame on the
   roll is a well like every tile above it, holding our mark instead of
   somebody's picture. Made of the page's own object rather than placed after
   it - and the riskiest, because a well is where a picture goes.
   --------------------------------------------------------------------------- */

function HeaderQuietPill() {
  return (
    <Pill>
      <Link {...HOME}>
        <Wordmark markClassName="h-5 w-auto" labelClassName="text-[0.9375rem]" />
      </Link>
      <span className="eyebrow shrink-0">Free event page</span>
    </Pill>
  );
}

function FooterOneMoreFrame() {
  return (
    <section className="px-4 pb-12 sm:px-5 sm:pb-14">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">End of the roll</p>
        <div className="recess mt-3 flex flex-col items-center gap-5 px-6 py-9 text-center sm:flex-row sm:justify-between sm:gap-6 sm:px-8 sm:text-left">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <LogoMark variant="reversed" className="h-9 w-auto shrink-0" />
            <span>
              <h2 className="text-[1.375rem] text-chalk">Your own, free</h2>
              <span className="mt-1.5 block font-mono text-micro uppercase tracking-[0.16em] text-rose-soft">
                {FREE_FACTS}
              </span>
            </span>
          </div>
          <ButtonLink {...HOME} variant="onDark" className="w-full shrink-0 sm:w-auto">
            Collect photos at your event
          </ButtonLink>
        </div>
        <p className="mt-3 text-label leading-relaxed text-mist">
          This is how the host collected every photo above - one code on the
          table, no app and no accounts.
        </p>
      </div>
    </section>
  );
}

/* --- 03 · The caption ------------------------------------------------------
   No bar over the cover at all: our name is a caption, in the register the
   system keeps for machine-readable things. At the end the ground sinks a
   shade and carries the closed page's three holes, one line and one link.
   --------------------------------------------------------------------------- */

function HeaderCaption() {
  return (
    <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 pt-3 sm:px-5 sm:pt-4">
      <LogoMark className="h-4 w-auto opacity-80" />
      <Link
        {...HOME}
        className="eyebrow underline decoration-edge underline-offset-4 hover:decoration-mist"
      >
        Free event page by Shot &amp; Share
      </Link>
    </div>
  );
}

function FooterSunkHoles() {
  return (
    <section className="bg-blush">
      <div className="mx-auto max-w-3xl px-4 py-11 text-center sm:px-5 sm:py-14">
        <div className="flex justify-center gap-2.5">
          <Hole size={14} />
          <Hole size={22} />
          <Hole size={11} />
        </div>
        <h2 className="mt-6 text-h3 sm:text-h2">Having an event of your own?</h2>
        <p className="mx-auto mt-3 max-w-md text-small leading-relaxed text-ash">
          This is how the host collected every photo here - one code on the
          table, no app and no accounts.
        </p>
        <p className="eyebrow mt-4">{FREE_FACTS}</p>
        <TextLink className="mt-4">Set one up in two minutes</TextLink>
      </div>
    </section>
  );
}

/* --- 04 · Contact sheet ----------------------------------------------------
   The hero's own artefact, at footer size: a strip of frames with the last one
   ours. A guest who has just scrolled a gallery reads a contact sheet as the
   same object photographed smaller, which is the point - we are the sheet the
   night ends up on, not a banner underneath it.
   --------------------------------------------------------------------------- */

function FooterContactSheet() {
  return (
    <section className="bg-blush">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5 sm:py-12">
        <p className="eyebrow text-center">Every photo, one sheet</p>

        <ul className="mt-4 grid grid-cols-6 gap-1.5 sm:gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i}>
              <PhotoPlaceholder className="aspect-square w-full" />
            </li>
          ))}
          {/* The sixth frame is ours, and it is the same well as the five
              beside it - the mark sits in it the way a photograph would. */}
          <li className="recess flex aspect-square items-center justify-center">
            <LogoMark variant="reversed" className="h-1/2 w-auto" />
          </li>
        </ul>

        <div className="mt-6 text-center">
          <h2 className="text-h3 sm:text-h2">Your night, on one sheet</h2>
          <p className="mx-auto mt-2 max-w-sm text-small leading-relaxed text-ash">
            Free for your own event - {FREE_FACTS.toLowerCase().slice(7)}.
          </p>
          <ButtonLink {...HOME} size="lg" className="mt-5 w-full sm:w-auto">
            Start a free event
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/* --- 05 · Perforation ------------------------------------------------------
   Film edge. The header is a run of holes at 9px with our name set into it,
   and the footer is the same run above and below a sunk band. It is the one
   variant whose branding is a texture rather than an object, which makes it
   the hardest to read as an advert and the easiest to miss.
   --------------------------------------------------------------------------- */

function HeaderPerforated() {
  return (
    <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-3 sm:px-5 sm:pt-4">
      <Perforation count={4} />
      <Link {...HOME} className="eyebrow whitespace-nowrap hover:text-ash">
        Shot &amp; Share · free event page
      </Link>
      <div className="min-w-0 flex-1">
        <Perforation count={16} />
      </div>
    </div>
  );
}

function FooterPerforated() {
  return (
    <section className="bg-blush">
      <div className="py-4">
        <Perforation count={24} />
      </div>
      <div className="mx-auto max-w-3xl px-4 pb-2 text-center sm:px-5">
        <h2 className="text-h3 sm:text-h2">The same roll, for your event</h2>
        <p className="mx-auto mt-3 max-w-md text-small leading-relaxed text-ash">
          Guests scan one code and everything they shoot lands with you. Nothing
          to install, nothing to sign into.
        </p>
        <ButtonLink {...HOME} size="lg" className="mt-5 w-full sm:w-auto">
          Create your free event
        </ButtonLink>
        <p className="eyebrow mt-4">{FREE_FACTS}</p>
      </div>
      <div className="py-4">
        <Perforation count={24} />
      </div>
    </section>
  );
}

/* --- 06 · The card from the table ------------------------------------------
   The guest is holding the phone they scanned a code with twenty minutes ago.
   This is that card again, at the end of the page: the mark inside the logo's
   own bracket frame, and the sentence that connects the two objects. The most
   specific of the ten, and the only one that refers to something the guest
   physically touched.
   --------------------------------------------------------------------------- */

function FooterTableCard() {
  return (
    <section className="px-4 pb-10 sm:px-5 sm:pb-12">
      <div className="card mx-auto flex max-w-3xl flex-col items-center gap-5 px-6 py-7 text-center sm:flex-row sm:gap-7 sm:px-8 sm:text-left">
        {/* A stand-in for the printed card: the bracket frame with the mark in
            it, at the size the real one prints. */}
        <div className="flex size-24 shrink-0 items-center justify-center rounded-card bg-blush">
          <LogoMark className="h-14 w-auto" />
        </div>
        <div>
          <p className="eyebrow">The card on your table</p>
          <h2 className="mt-2 text-h3">Yours can be on a table too</h2>
          <p className="mt-2 max-w-sm text-small leading-relaxed text-ash">
            Print one code, put it out, and every photo your guests take comes
            back to you. {FREE_FACTS}.
          </p>
          <TextLink className="mt-3">Make one for your event</TextLink>
        </div>
      </div>
    </section>
  );
}

/* --- 07 · The stamp --------------------------------------------------------
   A photographer's stamp on the back of a print: the mark and four words, set
   small and to one side, and nothing else anywhere on the page except a line
   of mono at the very bottom. The quietest possible version, and the test of
   how much a guest will follow on curiosity alone.
   --------------------------------------------------------------------------- */

function HeaderStamp() {
  return (
    <div className="mx-auto flex max-w-3xl justify-end px-4 pt-3 sm:px-5 sm:pt-4">
      <Link
        {...HOME}
        className="inline-flex items-center gap-1.5 opacity-70 transition-opacity hover:opacity-100"
      >
        <LogoMark className="h-3.5 w-auto" />
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-mist">
          Shot &amp; Share
        </span>
      </Link>
    </div>
  );
}

function FooterStamp() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-12 text-center sm:px-5 sm:pb-14">
      <p className="eyebrow">
        Collected with Shot &amp; Share · {FREE_FACTS.toLowerCase()}
      </p>
      <TextLink className="mt-2 text-small">Set one up for your event</TextLink>
    </section>
  );
}

/* --- 08 · Print margin -----------------------------------------------------
   A print has a white margin and the signature goes in it. So the gallery ends
   on paper: the last band is the margin, our line is set in it small and left,
   and the offer is on the right where a photographer's edition number would
   be. Nothing announces itself; the page simply has a bottom edge that is ours.
   --------------------------------------------------------------------------- */

function FooterPrintMargin() {
  return (
    <section className="px-4 pb-10 sm:px-5 sm:pb-12">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-card bg-paper px-6 py-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-8">
        <div className="flex items-center gap-3">
          <LogoMark className="h-6 w-auto shrink-0" />
          <p className="text-label leading-relaxed text-ash">
            Every photo above was collected with Shot &amp; Share.
            <span className="block text-mist">{FREE_FACTS}</span>
          </p>
        </div>
        <ButtonLink {...HOME} className="w-full shrink-0 sm:w-auto">
          Try it for your event
        </ButtonLink>
      </div>
    </section>
  );
}

/* --- 09 · How it worked ----------------------------------------------------
   The mechanism instead of the pitch, rebuilt in the system: no white sales
   card, just the ground stepping down and three lines numbered in mono. A
   guest who has uploaded already believes it works; what they do not know is
   how little the host did, and that is the sentence that turns one into the
   other.
   --------------------------------------------------------------------------- */

const STEPS = [
  { n: "01", label: "The host made an event", note: "Two minutes, no card." },
  { n: "02", label: "A code went on the table", note: "Printed, or on a phone." },
  { n: "03", label: "You added a photo", note: "No app, no account." },
];

function FooterHowItWorked() {
  return (
    <section className="bg-blush">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5 sm:py-12">
        <p className="eyebrow">How these photos got here</p>

        <ol className="mt-5 grid gap-4 sm:grid-cols-3 sm:gap-6">
          {STEPS.map((step) => (
            <li key={step.n} className="flex gap-3 sm:block">
              <span className="font-mono text-micro tracking-[0.16em] text-claret">
                {step.n}
              </span>
              <span className="block sm:mt-2">
                <span className="block text-small font-semibold leading-snug">
                  {step.label}
                </span>
                <span className="mt-0.5 block text-label text-ash">
                  {step.note}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-body font-semibold">
            Doing the same for your own event costs nothing.
          </p>
          <ButtonLink {...HOME} className="w-full shrink-0 sm:w-auto">
            Start a free event
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/* --- 10 · Sticky only ------------------------------------------------------
   Nothing at the top, one line of colophon at the bottom, and the whole ask in
   the floating pill that arrives once the guest has scrolled past the gallery
   (see `platform-invite-bar.tsx`). The only variant that catches the visit
   which never reaches the end of the page, which on a phone at a party is most
   of them - and the only one that puts anything over the host's photographs.
   --------------------------------------------------------------------------- */

function HeaderNone() {
  return null;
}

function FooterColophon() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-10 sm:px-5 sm:pb-12">
      <p className="eyebrow">
        <Link {...HOME} className="underline decoration-edge underline-offset-4">
          Shot &amp; Share
        </Link>{" "}
        · free event page · {FREE_FACTS.toLowerCase()}
      </p>
    </section>
  );
}

/* --- the set ---------------------------------------------------------------- */

export interface BannerVariant {
  key: string;
  name: string;
  /** One line, for the preview page. */
  note: string;
  Header: () => React.ReactNode;
  Footer: () => React.ReactNode;
  /** Whether this one depends on the floating pill to do its work. */
  sticky?: boolean;
}

export const VARIANTS: BannerVariant[] = [
  {
    key: "pill-card",
    name: "01 · Pill & Card",
    note: "The site's floating pill over the cover, the same paper again as a card at the end.",
    Header: HeaderPillCard,
    Footer: FooterPillCard,
  },
  {
    key: "one-more-frame",
    name: "02 · One more frame",
    note: "The last frame on the roll is a well like every tile above it, with our mark in it.",
    Header: HeaderQuietPill,
    Footer: FooterOneMoreFrame,
  },
  {
    key: "caption",
    name: "03 · The caption",
    note: "No bar at all - a caption beside the host's date, and a sunk band with three holes.",
    Header: HeaderCaption,
    Footer: FooterSunkHoles,
  },
  {
    key: "contact-sheet",
    name: "04 · Contact sheet",
    note: "The hero's own artefact at footer size: six frames, the last one ours.",
    Header: HeaderQuietPill,
    Footer: FooterContactSheet,
  },
  {
    key: "perforation",
    name: "05 · Perforation",
    note: "Film edge. Branding as a texture rather than an object, top and bottom.",
    Header: HeaderPerforated,
    Footer: FooterPerforated,
  },
  {
    key: "table-card",
    name: "06 · The card from the table",
    note: "The card the guest scanned, printed again at the end of the page.",
    Header: HeaderPillCard,
    Footer: FooterTableCard,
  },
  {
    key: "stamp",
    name: "07 · The stamp",
    note: "A photographer's stamp in the corner, and one line of mono at the bottom.",
    Header: HeaderStamp,
    Footer: FooterStamp,
  },
  {
    key: "print-margin",
    name: "08 · Print margin",
    note: "The page ends on paper: our signature in the margin, the offer where an edition number goes.",
    Header: HeaderCaption,
    Footer: FooterPrintMargin,
  },
  {
    key: "how-it-worked",
    name: "09 · How it worked",
    note: "Three steps on sunk ground - the mechanism instead of the pitch.",
    Header: HeaderQuietPill,
    Footer: FooterHowItWorked,
  },
  {
    key: "sticky-only",
    name: "10 · Sticky only",
    note: "Nothing on top, one line at the bottom, and the floating pill does all the work.",
    Header: HeaderNone,
    Footer: FooterColophon,
    sticky: true,
  },
];
