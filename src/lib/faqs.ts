import { formatBytes } from "@/utils/format";
import { KEEPING, TIERS, photoCountLabel } from "@/lib/tiers";

export type FaqTopic = "guests" | "photos" | "paying";

export interface Faq {
  topic: FaqTopic;
  question: string;
  /** The answer in a word or two, set in bold ahead of the rest. */
  short: string;
  answer: string;
}

export const FAQ_TOPICS: ReadonlyArray<readonly [topic: FaqTopic, label: string]> = [
  ["guests", "Guests"],
  ["photos", "Photos"],
  ["paying", "Paying"],
];

export const FAQS: ReadonlyArray<Faq> = [
  {
    topic: "guests",
    question: "Do guests need an app or account?",
    short: "No.",
    answer: "They scan the code, it opens in the browser, and they pick photos.",
  },
  {
    topic: "guests",
    question: "Does it work on iPhone and Android?",
    short: "Both.",
    answer: "Any modern browser. iPhone photos are saved in a format every device opens.",
  },
  {
    topic: "guests",
    question: "Can guests see each other's photos?",
    short: "If you want.",
    answer: "The shared gallery is on by default. Turn it off per event.",
  },
  {
    topic: "photos",
    question: "Do photos lose quality?",
    short: "No.",
    answer: "Every pixel stays. The file gets smaller, the picture doesn't.",
  },
  {
    topic: "photos",
    question: "How many photos fit?",
    short: `Up to ${photoCountLabel(TIERS.pro.quotaBytes)}.`,
    answer: `About ${photoCountLabel(TIERS.free.quotaBytes)} free, ${photoCountLabel(TIERS.plus.quotaBytes)} on ${TIERS.plus.name} and ${photoCountLabel(TIERS.pro.quotaBytes)} on ${TIERS.pro.name}.`,
  },
  {
    topic: "photos",
    question: "Is video included?",
    short: "On paid plans.",
    answer: `Up to ${formatBytes(TIERS.plus.maxFileBytes, 0)} a clip on ${TIERS.plus.name}, ${formatBytes(TIERS.pro.maxFileBytes, 0)} on ${TIERS.pro.name}.`,
  },
  {
    topic: "photos",
    question: "What if someone uploads something bad?",
    short: "You remove it.",
    answer: "Uploads are screened, guests can report, and you can delete anything or revoke the link.",
  },
  {
    topic: "paying",
    question: "Do I pay before the event?",
    short: "No.",
    answer: `Create the event and print the code free. Expecting more than ${photoCountLabel(TIERS.free.quotaBytes)} photos? Upgrade before the day.`,
  },
  {
    topic: "paying",
    question: "How many events can I run for free?",
    short: "One at a time.",
    answer: `${TIERS.free.name} holds one event at a time. Upgrade it or delete it and you can start another, and an event on a paid plan never counts against it.`,
  },
  {
    topic: "paying",
    question: "What happens when storage ends?",
    short: "It pauses.",
    answer: `Reminders 14, 7 and 1 days before, then 14 days to restore. Keep it online from €${KEEPING.plus.priceEur} a year.`,
  },
  {
    topic: "paying",
    question: "What if it fails on the day?",
    short: "Full refund.",
    answer: "Even after the event. Write to us and the money goes back to your card.",
  },
];
