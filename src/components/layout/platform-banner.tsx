import Link from "next/link";
import { MdOutlineAddCircleOutline } from "react-icons/md";

import { LogoMark, Wordmark } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui";
import { TIERS, photoCountLabel } from "@/lib/tiers";

/**
 * The Shot & Share header and footer on a free event - the free plan's price,
 * and the only advertisement this product has: every guest at somebody's
 * wedding sees it. Paid events remove both, which is most of what "custom
 * event page" buys.
 *
 * Both are made of parts the product already has, so neither reads as a banner
 * stuck onto the host's page. The header is the house's floating pill, the one
 * from `HeaderShell` on every marketing page: paper at 92%, a soft shadow,
 * blurred behind, on the page's own gutter. The footer is that same paper
 * floating again as a card at the end. Nothing is outlined, nothing is
 * full-bleed, and the only dark surface on the page stays what it always is -
 * a well with a photograph in it.
 *
 * Everything reads the theme variables rather than a fixed hex, so both follow
 * a themed page if free events ever get one.
 */

/**
 * The free plan in the three facts a card has room for on one line, quoted
 * from the tier rather than typed, so it cannot drift from the pricing page.
 * Retention is the fourth fact and the least persuasive of them: on a 320px
 * phone it is what pushes this onto a second line with two words on it.
 */
const FREE_FACTS = [
  "Free",
  `${photoCountLabel(TIERS.free.quotaBytes)} photos`,
  "no app",
].join(" · ");

const HOME = { href: "/", target: "_blank", rel: "noopener" } as const;

export function PlatformHeader() {
  return (
    <div className="px-4 pt-3 sm:px-5 sm:pt-4">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl bg-paper/92 px-3 py-2 shadow-sm backdrop-blur sm:px-4 sm:py-2.5">
        {/* `flex`, not the default inline: an inline anchor is as tall as the
            line box around it - 29px at body leading - and the mark then sits
            on that box's baseline rather than in its middle, which reads as a
            logo hung four pixels too high. */}
        <Link
          {...HOME}
          className="flex min-w-0 items-center"
          aria-label="Shot & Share, home"
        >
          {/* The name holds down to a 375px phone - an iPhone mini. Below
              that the bar is the mark and the button, which is what it is
              for. */}
          <Wordmark
            markClassName="h-5 w-auto shrink-0"
            labelClassName="whitespace-nowrap text-[0.875rem] max-[374px]:hidden xs:text-[0.9375rem]"
          />
        </Link>

        {/* Filled, because eleven pixels of underlined mono is not a tap
            target and this is the only thing in the bar a guest can act on -
            but a size below `sm`, so it stays a chip next to the name rather
            than the loudest thing above the host's cover. */}
        <ButtonLink {...HOME} size="xs" className="shrink-0 rounded-xl">
          Start for Free
        </ButtonLink>
      </div>
    </div>
  );
}

export function PlatformFooter() {
  return (
    <section className="px-4 pb-10 sm:px-5 sm:pb-12">
      <div className="card mx-auto max-w-3xl px-6 py-8 text-center sm:px-8 sm:py-10">
        <LogoMark className="mx-auto h-7 w-auto" />

        <h2 className="mt-4 text-h3 sm:text-h2">
          Your event can have one of these.
        </h2>

        <p className="mx-auto mt-3 max-w-xs text-small leading-relaxed text-ash">
          One code on the table, and every photo lands with you.
        </p>

        <ButtonLink {...HOME} size="lg" className="mt-6 w-full sm:w-auto">
          <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
          Create your event
        </ButtonLink>

        <p className="eyebrow mt-4 text-balance">{FREE_FACTS}</p>
      </div>
    </section>
  );
}
