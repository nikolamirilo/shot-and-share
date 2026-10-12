import Link from "next/link";
import { MdCheck, MdClose, MdRemove } from "react-icons/md";

import { LogoMark } from "@/components/layout/Logo";
import { Eyebrow, cx } from "@/components/ui";
import { TIERS } from "@/lib/tiers";
import { formatBytes } from "@/utils/format";

type Mark = "yes" | "no" | "some" | null;
type Cell = readonly [mark: Mark, text: string];

const RIVALS = ["Group chat", "Shared album", "Disposable camera"];

const ROWS: ReadonlyArray<{ label: string; us: Cell; them: readonly [Cell, Cell, Cell] }> = [
  {
    label: "Every guest can add photos",
    us: ["yes", "Scan the code"],
    them: [["no", "Chat members only"], ["no", "Needs the right account"], ["no", "One camera per table"]],
  },
  {
    label: "Full resolution",
    us: ["yes", "Every pixel"],
    them: [["no", "Compressed"], ["some", "Depends on the app"], ["no", "27 shots"]],
  },
  {
    label: "iPhone and Android together",
    us: ["yes", "One gallery"],
    them: [["yes", "Yes"], ["no", "Split by platform"], ["some", "Film only"]],
  },
  {
    label: "Video",
    us: ["yes", `Up to ${formatBytes(TIERS.pro.maxFileBytes, 0)}`],
    them: [["no", "Compressed"], ["yes", "Yes"], ["no", "No"]],
  },
  {
    label: "Everything in one download",
    us: ["yes", "One ZIP"],
    them: [["no", "Save one by one"], ["some", "Depends on the app"], ["no", "Wait for prints"]],
  },
  {
    label: "Price",
    us: [null, `Free to try, from €${TIERS.plus.priceEur} once`],
    them: [[null, "Free"], [null, "Free"], [null, "About €15 each"]],
  },
];

const ICONS = { yes: MdCheck, no: MdClose, some: MdRemove };

function CellText({ cell: [mark, text], onClaret = false }: { cell: Cell; onClaret?: boolean }) {
  const Icon = mark ? ICONS[mark] : null;
  return (
    <span className="flex items-center gap-2 leading-snug">
      {Icon && (
        <span
          aria-hidden
          className={cx(
            "grid size-5 shrink-0 place-items-center rounded-full text-[0.8rem]",
            mark === "yes" && (onClaret ? "bg-chalk text-claret" : "bg-pine text-chalk"),
            mark === "no" && "bg-blush text-claret",
            mark === "some" && "bg-blush text-mist",
          )}
        >
          <Icon />
        </span>
      )}
      {text}
    </span>
  );
}

const HEAD = "px-4 pb-3.5 pt-5 font-mono text-micro font-normal uppercase tracking-[0.14em]";
const BODY = "border-b px-4 py-3.5";
// Keeps the row labels in view while the table scrolls sideways on a phone.
const STICKY = "sticky left-0 z-[1] w-[24%] bg-paper";

export function Why() {
  return (
    <section className="bg-linen">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-5 sm:py-20 lg:py-24">
        <Eyebrow>Why this one</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-[2.25rem] [word-spacing:0.1em] sm:text-[3.5rem]">
          Every other way loses photos.
        </h2>

        <div className="card mt-8 overflow-x-auto sm:mt-10">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-[0.9375rem]">
            <thead>
              <tr>
                <th scope="col" className={cx(HEAD, STICKY)}>
                  <span className="sr-only">Compared on</span>
                </th>
                <th scope="col" className={cx(HEAD, "rounded-t-[0.875rem] bg-claret text-chalk")}>
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-5 shrink-0">
                      <LogoMark variant="reversed" className="h-full w-full" />
                    </span>
                    Shot &amp; Share
                  </span>
                </th>
                {RIVALS.map((name) => (
                  <th key={name} scope="col" className={cx(HEAD, "text-mist")}>
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, r) => {
                const last = r === ROWS.length - 1;
                return (
                  <tr key={row.label}>
                    <th
                      scope="row"
                      className={cx(BODY, STICKY, "border-blush font-semibold leading-snug", last && "border-b-0")}
                    >
                      {row.label}
                    </th>
                    <td
                      className={cx(
                        BODY,
                        "border-chalk/14 bg-claret font-semibold text-chalk",
                        last && "rounded-b-[0.875rem] border-b-0",
                      )}
                    >
                      <CellText cell={row.us} onClaret />
                    </td>
                    {row.them.map((cell, i) => (
                      <td key={RIVALS[i]} className={cx(BODY, "border-blush", last && "border-b-0")}>
                        <CellText cell={cell} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="inline-flex items-center rounded-full px-3.5 py-2 text-small font-semibold text-claret shadow-[inset_0_0_0_1.5px_var(--color-claret)]">
            Fails on the day? Full refund.
          </span>
          <Link
            href="/pricing"
            className="font-semibold underline decoration-claret decoration-2 underline-offset-4 hover:decoration-ink"
          >
            See the plans
          </Link>
        </div>
      </div>
    </section>
  );
}
