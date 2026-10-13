import { LogoMark } from "@/components/layout/Logo";
import { Eyebrow, cx } from "@/components/ui";
import { KEEPING, TIERS, photoCountLabel, retentionLabel } from "@/lib/tiers";

const HEAD =
  "px-4 pb-3.5 pt-5 font-mono text-micro font-normal uppercase tracking-[0.14em]";
const BODY = "border-b px-4 py-4";
// Keeps the row labels in view while the table scrolls sideways on a phone.
const STICKY = "sticky left-0 z-[1] bg-ink";

export function ComparisonTable() {
  const rows: Array<[string, string, string]> = [
    [
      "Photos on the free plan",
      "50",
      `About ${photoCountLabel(TIERS.free.quotaBytes)}`,
    ],
    ["Bulk download when free", "No", "Yes"],
    ["Free QR code", "Watermarked", "Clean"],
    [
      "Mid tier",
      "$24.99 for 200 photos, 30 days",
      `€${TIERS.plus.priceEur} for ~${photoCountLabel(TIERS.plus.quotaBytes)}, ${retentionLabel(TIERS.plus)}`,
    ],
    ["Top tier", "$49.99, 90 days", `€${TIERS.pro.priceEur}, ${retentionLabel(TIERS.pro)}`],
    [
      "Keep photos permanently",
      "$49 every year",
      `from €${KEEPING.plus.priceEur}/year`,
    ],
  ];

  return (
    <section className="bg-ink text-linen">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-5 sm:py-20 lg:py-24">
        <Eyebrow className="text-rose-soft">Side by side</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-[2.25rem] [word-spacing:0.1em] sm:text-[3.5rem]">
          Slightly cheaper. Dramatically more generous.
        </h2>
        <p className="mt-4 max-w-xl text-small text-linen/70 [text-wrap:pretty]">
          Compared against the best-known alternative in this category, using
          their published prices.
        </p>

        <div className="mt-8 overflow-x-auto sm:mt-10">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left text-[0.9375rem]">
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[32%]" />
              <col className="w-[32%]" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className={cx(HEAD, STICKY)}>
                  <span className="sr-only">Compared on</span>
                </th>
                <th scope="col" className={cx(HEAD, "text-linen/55")}>
                  Them
                </th>
                <th
                  scope="col"
                  className={cx(
                    HEAD,
                    "rounded-t-[0.875rem] bg-claret text-chalk",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-5 shrink-0">
                      <LogoMark variant="reversed" className="h-full w-full" />
                    </span>
                    Shot &amp; Share
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, them, us], i) => {
                const last = i === rows.length - 1;
                return (
                  <tr key={label}>
                    <th
                      scope="row"
                      className={cx(
                        BODY,
                        STICKY,
                        "border-linen/12 font-semibold leading-snug",
                        last && "border-b-0",
                      )}
                    >
                      {label}
                    </th>
                    <td
                      className={cx(
                        BODY,
                        "border-linen/12 text-linen/60",
                        last && "border-b-0",
                      )}
                    >
                      {them}
                    </td>
                    <td
                      className={cx(
                        BODY,
                        "border-chalk/14 bg-claret font-semibold text-chalk",
                        last && "rounded-b-[0.875rem] border-b-0",
                      )}
                    >
                      {us}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
