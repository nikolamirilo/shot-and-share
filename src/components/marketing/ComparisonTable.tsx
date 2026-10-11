import { Eyebrow } from "@/components/ui";
import { KEEPING, TIERS, photoCountLabel } from "@/lib/tiers";

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
      `€${TIERS.plus.priceEur} for ~${photoCountLabel(TIERS.plus.quotaBytes)}, 6 months`,
    ],
    ["Top tier", "$49.99, 90 days", `€${TIERS.pro.priceEur}, 12 months`],
    [
      "Keep photos permanently",
      "$49 every year",
      `from €${KEEPING.plus.priceEur}/year`,
    ],
  ];

  return (
    <section className="bg-ink text-linen">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-5 sm:py-16">
        <Eyebrow className="text-rose-soft">Side by side</Eyebrow>
        <h2 className="mt-3 text-[2.25rem] sm:text-h1">
          Slightly cheaper. Dramatically more generous.
        </h2>
        <p className="mt-4 max-w-xl text-[0.9375rem] text-linen/70">
          Compared against the best-known alternative in this category, using
          their published prices.
        </p>

        <div className="-mx-4 mt-8 overflow-x-auto px-4 sm:mx-0 sm:mt-9 sm:px-0">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="bg-linen/8">
                <th className="py-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-linen/55">
                  &nbsp;
                </th>
                <th className="py-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-linen/55">
                  Them
                </th>
                <th className="py-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rose-soft">
                  Us
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, them, us]) => (
                <tr key={label} className="odd:bg-linen/4">
                  <td className="py-3.5 pr-4 text-[0.9375rem]">{label}</td>
                  <td className="py-3.5 pr-4 text-[0.9375rem] text-linen/60">
                    {them}
                  </td>
                  <td className="py-3.5 text-[0.9375rem] font-bold text-rose-soft">
                    {us}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
