import { MdHd, MdOutlineTouchApp, MdVerifiedUser } from "react-icons/md";

import { Eyebrow, Hole } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { HARD_DELETE_GRACE_DAYS, KEEPING, RETENTION_WARNING_DAYS, TIERS } from "@/lib/tiers";

/** [14, 7, 1] as people say it: "14, 7 and 1". */
const said = (n: number[]) => `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;

/**
 * Three promises, each answering a fear a host actually has: the guests will
 * not bother, the photos will be bad, the photos will disappear. It used to be
 * six equal items mixing policies with features, which read as a spec sheet.
 */
export function Why() {
  const pillars = [
    {
      Icon: MdOutlineTouchApp,
      title: "Guests actually upload",
      points: [
        ["No limit on how many at once.", "A whole camera roll goes in one tap."],
        ["Uploads start with the first photo,", "so nobody waits for the slowest one."],
        ["A dropped connection retries on its own,", "so a wobbly venue signal does not lose a photo."],
      ],
    },
    {
      Icon: MdHd,
      title: "The photos stay good",
      points: [
        ["Every photo keeps its pixels.", "Smaller files, not smaller pictures."],
        ["iPhone photos open everywhere,", "saved in a format Windows and Android can read."],
        [
          "Videos play on any device.",
          `On the paid plans, up to ${formatBytes(TIERS.pro.maxFileBytes, 0)} a clip.`,
        ],
      ],
    },
    {
      Icon: MdVerifiedUser,
      title: "Nothing gets lost",
      points: [
        [`Reminders at ${said(RETENTION_WARNING_DAYS)} days`, "before your storage window ends."],
        ["Paused, not deleted,", `and restorable for another ${HARD_DELETE_GRACE_DAYS} days after that.`],
        [`Keep them online from €${KEEPING.plus.priceEur} a year,`, "for as long as you want them."],
      ],
    },
  ];

  return (
    <section className="bg-linen">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-5 sm:py-20 lg:py-24">
        <Eyebrow>Why this one</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-[2.25rem] [word-spacing:0.1em] sm:text-[3.5rem]">
          Built for the person who has to collect them afterwards.
        </h2>

        <div className="mt-10 grid gap-9 md:grid-cols-3 md:gap-10">
          {pillars.map(({ Icon, title, points }) => (
            <div key={title}>
              <span className="hole grid h-13 w-13 place-items-center text-rose-soft">
                <Icon aria-hidden className="text-[24px]" />
              </span>
              <h3 className="mt-4 text-[1.6rem] [word-spacing:0.1em] sm:text-[1.875rem]">{title}</h3>
              <ul className="mt-3.5 space-y-3">
                {points.map(([strong, rest]) => (
                  <li key={strong} className="flex gap-3 text-[0.9375rem] leading-relaxed text-ash">
                    <Hole size={9} className="mt-2" />
                    <span>
                      <b className="font-semibold text-ink">{strong}</b> {rest}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
