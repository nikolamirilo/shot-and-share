import { formatBytes } from "@/lib/format";
import { KEEP_FOREVER, TIERS, photoCountLabel } from "@/lib/tiers";

/**
 * The questions on the landing page.
 *
 * They live here rather than inside the component because two things read
 * them: the page a person sees, and the FAQPage structured data a crawler
 * reads. Structured data that disagrees with the page it describes is worse
 * than none at all, so there is one array and both render from it.
 */
export const FAQS: ReadonlyArray<readonly [question: string, answer: string]> =
  [
    [
      "Do guests need an account?",
      "No. They open the link, choose photos and upload. There is no sign-in prompt anywhere on the guest side, on purpose - it is the single biggest reason people fail to hand over their photos.",
    ],
    [
      "What happens when the storage window ends?",
      `You get emails 14, 7 and 1 days before. When it ends the event is paused rather than deleted, and stays restorable for another 14 days. Add ${KEEP_FOREVER.name} at any point and nothing is ever removed.`,
    ],
    [
      "Can I stop people uploading?",
      "Yes. Revoke the link from your dashboard and it stops working immediately. You can issue a fresh one for the people who should still have it.",
    ],
    [
      "How many photos actually fit?",
      `${TIERS.plus.name} holds about ${photoCountLabel(TIERS.plus.quotaBytes)} and ${TIERS.pro.name} about ${photoCountLabel(TIERS.pro.quotaBytes)}, based on a 7 MB photo. Modern phones vary, which is exactly why the limit is in gigabytes rather than a photo count.`,
    ],
    [
      "Can guests see the photos everyone else uploaded?",
      "That is your choice per event. The shared gallery is on by default because guests like seeing the night from other people's phones, and you can turn it off.",
    ],
    [
      "Is video included?",
      `On the paid plans: up to ${formatBytes(TIERS.plus.maxFileBytes, 0)} a clip on ${TIERS.plus.name}, and up to ${formatBytes(TIERS.pro.maxFileBytes, 0)} on ${TIERS.pro.name}. The free plan is photos only: one large video can eat the entire free allowance, which would make the free plan useless for what it is meant to prove.`,
    ],
  ];
