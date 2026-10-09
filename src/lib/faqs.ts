import { formatBytes } from "@/lib/format";
import { KEEPING, TIERS, photoCountLabel } from "@/lib/tiers";

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
      "Do my guests need an app or an account?",
      "No. They scan the code, the page opens in their browser, and they pick photos. There is no sign-in anywhere on the guest side, on purpose: every sign-in prompt is a guest who gives up.",
    ],
    [
      "Does it work on iPhone and Android?",
      "Yes, in any modern browser. iPhones save photos as HEIC, which many Windows and Android devices can't open, so they are stored in a format every device can.",
    ],
    [
      "Are the photos compressed, like in WhatsApp?",
      "They keep every pixel they were taken with. Each photo is re-encoded into a smaller file on the guest's phone before it uploads, which is why uploads finish on venue wifi, but nothing is scaled down.",
    ],
    [
      "How many photos actually fit?",
      `${TIERS.plus.name} holds about ${photoCountLabel(TIERS.plus.quotaBytes)} and ${TIERS.pro.name} about ${photoCountLabel(TIERS.pro.quotaBytes)}, based on a 7 MB photo. Modern phones vary, which is exactly why the limit is in gigabytes rather than a photo count.`,
    ],
    [
      "Do I have to pay before the event?",
      `No. Create the event and print the QR card for free, and upgrade whenever you like. If you expect more than about ${photoCountLabel(TIERS.free.quotaBytes)} photos, upgrade before the day so no guest finds a full event.`,
    ],
    [
      "Can guests see the photos everyone else uploaded?",
      "That is your choice per event. The shared gallery is on by default because guests like seeing the night from other people's phones, and you can turn it off.",
    ],
    [
      "What if someone uploads something they shouldn't?",
      "Uploads are screened before they appear in the gallery, guests can report a photo, and you can delete anything. If the link ends up somewhere it shouldn't, revoke it and it stops working at once.",
    ],
    [
      "What happens when the storage window ends?",
      `You get emails 14, 7 and 1 days before. When it ends the event is paused rather than deleted, and stays restorable for another 14 days. You can also keep the photos online past the window for €${KEEPING.plus.priceEur} a year on Plus or €${KEEPING.pro.priceEur} on Pro, cancellable whenever you like.`,
    ],
    [
      "Is video included?",
      `On the paid plans: up to ${formatBytes(TIERS.plus.maxFileBytes, 0)} a clip on ${TIERS.plus.name}, and up to ${formatBytes(TIERS.pro.maxFileBytes, 0)} on ${TIERS.pro.name}. The free plan is photos only: one large video can eat the entire free allowance, which would make the free plan useless for what it is meant to prove.`,
    ],
    [
      "What if it doesn't work on the day?",
      "Then you get a full refund, even after the event. If uploads failed, the gallery didn't load, the QR code didn't work or you couldn't download your photos, write to us and the money goes back to your card.",
    ],
  ];
