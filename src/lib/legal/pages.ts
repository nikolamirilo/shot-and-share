import {
  OPERATOR,
  OPERATOR_LINE,
  TAKEDOWN_RESPONSE_HOURS,
  addressLine,
} from "@/lib/legal/operator";
import { SITE } from "@/lib/seo";
import { HARD_DELETE_GRACE_DAYS, KEEP_FOREVER, TIERS, VAT_NOTE } from "@/lib/tiers";

/**
 * The four documents a merchant of record looks for.
 *
 * Everything stated about the system is true of this repository: retention
 * windows come from the constants the product enforces, prices come from the
 * tier table the checkout charges against, and the list of companies that touch
 * the data is the list of services this app calls. Nothing here is a placeholder.
 *
 * Still not a lawyer's documents. Photographs of identifiable people are
 * personal data, the host is their controller, and that split is worth paying
 * someone to check.
 */

export const UPDATED = "19 August 2026";

export interface Section {
  heading: string;
  body: string[];
  list?: string[];
}

export type LegalSlug = "terms" | "privacy" | "refund-policy" | "acceptable-use";

export interface LegalPage {
  /** The path it is served from, and its key in `LEGAL_PAGES`. */
  slug: LegalSlug;
  title: string;
  /** Short label for a footer column, where the full title is too long. */
  navLabel: string;
  intro: string;
  sections: Section[];
}

/** Where to write, said the same way on every page. */
const CONTACT = `Write to ${SITE.email} and a person answers.`;

/* -------------------------------------------------------------------------- */
/*  Terms                                                                      */
/* -------------------------------------------------------------------------- */

const TERMS: LegalPage = {
  slug: "terms",
  title: "Terms & Conditions",
  navLabel: "Terms",
  intro:
    "What Shot & Share does, what you pay, and what each of us is responsible for. Written to be read rather than to be survived.",
  sections: [
    {
      heading: "Who you are buying from",
      body: [
        `${OPERATOR_LINE} The registered address is ${addressLine()}, and post is delivered through ${OPERATOR.address.postOffice}.`,
        `Company registration number (matični broj) ${OPERATOR.registrationNumber}. Tax number (PIB) ${OPERATOR.taxNumber}. Registered activity ${OPERATOR.activity}, trading since ${OPERATOR.registeredOn}.`,
        `${CONTACT} These terms are between you, the person creating an event, who we call the host, and us. Creating an event means you accept them.`,
      ],
    },
    {
      heading: "What you get",
      body: [
        "You create an event and get a link and a printable QR code. Your guests open it on their phones and upload photos, and video on the paid plans. You can view everything they send, delete any of it, and download the whole event as a ZIP.",
        "Guests need no account, no app, and no name. That is the point of the product, and it is also why responsibility for what ends up in your gallery sits mostly with you.",
        "The plan you buy sets three things and nothing else: how many gigabytes the event holds, how long the photos are kept, and which of the extras are switched on. They are listed in full on the pricing page, and that page is the specification.",
      ],
    },
    {
      heading: "What you do not get",
      body: [
        "This is software you use, not a service we perform. Nobody attends your event, nobody takes photographs for you, nobody edits or retouches anything, and nobody curates your gallery. There is no photographer, no videographer and no design work involved at any point.",
        "It is not a backup. Storage is bounded by your plan and by the retention window, so download the ZIP rather than treating us as your only copy.",
        "There is no guaranteed uptime figure, no printing, and no physical delivery of anything. What arrives is access to the software, immediately, by email.",
      ],
    },
    {
      heading: "Your account",
      body: [
        "You sign in by email. You are responsible for keeping access to that inbox, because anyone who can open it can open your events.",
        "You must be old enough to enter a contract where you live. If you are creating an event for a company or a couple, you confirm you are allowed to agree to this on their behalf.",
      ],
    },
    {
      heading: "Plans and payment",
      body: [
        `Every plan is a one-time payment for one event. ${TIERS.plus.name} is €${TIERS.plus.priceEur} and ${TIERS.pro.name} is €${TIERS.pro.priceEur}. The ${KEEP_FOREVER.name} add-on is €${KEEP_FOREVER.priceEur}, also paid once, and keeps that event's photos permanently.`,
        "Nothing renews and nothing needs cancelling. There is no subscription, no trial that turns into a charge, and no card of yours stored by us.",
        `Payment is handled by Lemon Squeezy, who act as merchant of record. Your card details never reach us and your receipt comes from them. ${VAT_NOTE} Upgrading an event mid-way charges the difference rather than the full price again.`,
      ],
    },
    {
      heading: "Getting what you paid for",
      body: [
        "Access is granted by the payment provider's signed confirmation, not by your browser coming back from checkout. That usually takes seconds.",
        `If it does not arrive, open the event and use the recovery button on the plan panel. It asks the provider directly whether your order exists and applies it. If that still fails, ${SITE.email} will sort it by hand.`,
      ],
    },
    {
      heading: "Refunds",
      body: [
        "The refund policy is a page of its own and forms part of these terms. In short: fourteen days, and if the software did not work for your event we refund you whether or not the event has already happened.",
      ],
    },
    {
      heading: "How long we keep your event",
      body: [
        `Every plan states a storage window: ${TIERS.free.retentionDays} days on ${TIERS.free.name}, six months on ${TIERS.plus.name}, twelve months on ${TIERS.pro.name}, counted from the date of the event rather than the date you paid. We email you 14 days, 7 days and 1 day before it ends.`,
        `When it ends the event is paused rather than deleted. Nothing is removed, guests see a closed page, and you can restore it for ${HARD_DELETE_GRACE_DAYS} days. Only after that does anything get erased, and erasure is permanent.`,
        `The ${KEEP_FOREVER.name} add-on removes the window entirely.`,
      ],
    },
    {
      heading: "What may not be uploaded",
      body: [
        "The acceptable use policy is a page of its own and forms part of these terms. It binds you and everyone you give your link to.",
      ],
    },
    {
      heading: "Your photos stay yours",
      body: [
        "You and your guests keep every right in the photographs. We do not claim ownership, we do not use them to advertise the product, and we do not use them to train machine-learning models.",
        "You give us only the permission we need to run the service: to store the files, to make the thumbnails and previews the gallery displays, to screen them for prohibited content, to package them into a ZIP when you ask, and to serve them to whoever holds your link. That permission ends when the files are deleted.",
      ],
    },
    {
      heading: "You are responsible for your guests",
      body: [
        "Your link is the door to your event, and anyone holding it can upload. If it reaches somewhere it should not have, revoke it from the dashboard and it stops working immediately.",
        "Because the guests are yours and the event is yours, you are responsible for telling them what is being collected and for handling anyone who asks for a photo to be removed. You can delete any individual photo at any time, and you can switch the event to holding every upload for your approval before it appears.",
      ],
    },
    {
      heading: "What we do not promise",
      body: [
        "We work hard to keep the service up, particularly on a Saturday evening, but we do not promise it will never be unavailable. We do not promise a photograph can never be lost.",
        "We may change how features work. If a change removes something you paid for, tell us and we will refund you.",
      ],
    },
    {
      heading: "Suspending or ending an event",
      body: [
        "We can suspend or remove an event that breaks the acceptable use policy, or that we are legally required to act on. Where we can, we will tell you first and give you a chance to download what is there.",
        "You can delete your event and everything in it at any time, from Settings. That deletion is immediate and cannot be undone.",
      ],
    },
    {
      heading: "Liability",
      body: [
        "Nothing here limits liability for death, personal injury, or fraud, and nothing here takes away consumer rights that cannot be signed away.",
        "Beyond that, and as far as the law allows, what we owe you for any problem is capped at what you paid us for that event. We are not liable for indirect losses such as a missed opportunity, a lost contract, or the cost of reshooting something.",
      ],
    },
    {
      heading: "Changes to these terms",
      body: [
        "If we change them in a way that matters, we will email the address on your account before the change takes effect. Events already paid for keep the terms they were bought under.",
      ],
    },
    {
      heading: "Law and disputes",
      body: [
        "These terms are governed by the law of the Republic of Serbia and its courts have jurisdiction. If you are a consumer in the EU or the UK, you keep the protection of the mandatory law of the country you live in and can bring a claim there.",
        "Before any of that, please just write to us. Almost everything is fixable by email.",
      ],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/*  Privacy                                                                    */
/* -------------------------------------------------------------------------- */

const PRIVACY: LegalPage = {
  slug: "privacy",
  title: "Privacy Policy",
  navLabel: "Privacy",
  intro:
    "What we hold, why we are allowed to hold it, who else touches it, and how long it stays. This product processes photographs of people who never signed up for anything, so it matters more here than it does for most software.",
  sections: [
    {
      heading: "Who is responsible for what",
      body: [
        `For your host account, meaning your email address, your events and your payments, the controller is ${OPERATOR.legalName}, ${addressLine()}, registration number ${OPERATOR.registrationNumber}, tax number ${OPERATOR.taxNumber}. ${CONTACT}`,
        "For the photographs your guests upload, you are the controller and we are your processor. They are collected for your event, on your instructions, and we act on them rather than deciding anything about them ourselves.",
        `In practice that means a guest asking for a photo to be taken down should ask you first, and you can remove it in a click. If they cannot reach you, they can ask us and we will act within ${TAKEDOWN_RESPONSE_HOURS} hours.`,
      ],
    },
    {
      heading: "What we hold about hosts",
      body: [
        "The email address you sign in with, the events you create and their settings, and a record of what you paid for. That is the whole account.",
        "We do not ask for a postal address, a phone number, or a date of birth, because we do not need them.",
      ],
    },
    {
      heading: "What we hold about guests",
      body: [
        "No account, no email address, and no name. A guest uploads and leaves.",
        "A random identifier is stored in the guest's own browser so they can delete a photo they have just uploaded by mistake, and so we can count how many separate people contributed. It is not linked to a person, it does not follow them to any other site, and clearing their browser data removes it.",
        "We count how many times a link has been opened. That is a number, not a log of who opened it.",
      ],
    },
    {
      heading: "The photos and videos",
      body: [
        "They are stored in object storage in the European Union, in the Frankfurt region, encrypted at rest. Thumbnails are served from unguessable addresses and full-resolution originals only through short-lived signed links that expire.",
        "We do not browse your photographs, we do not use them to advertise the product, and we do not use them to train machine-learning models. No human at our end opens an event's gallery unless you ask us to help with a specific problem, or unless a photo has been flagged or reported and has to be looked at.",
      ],
    },
    {
      heading: "Location data in photographs",
      body: [
        "Phone cameras write hidden data into a photo file, and it often includes the exact place the picture was taken. At a party in someone's home that is a home address, attached to a file the guest did not think twice about.",
        "So we remove it. Photos are re-encoded in the guest's browser before they are uploaded, which drops the embedded camera data including location, and the copy that reaches our storage no longer carries it. Video has its location data stripped on our side during processing.",
        "The consequence is worth knowing: the ZIP you download does not contain the original camera metadata either. An address that cannot leak is worth more than an exposure setting nobody reads.",
      ],
    },
    {
      heading: "Moderation",
      body: [
        "Every photo is checked automatically as it arrives, before it becomes visible in any gallery. The check uses Amazon Rekognition content moderation and runs in the same EU region the files are stored in. Video is checked on the still frame taken from the clip.",
        "It returns category labels and nothing else. No photograph is retained by that service and nothing is sent anywhere for any other purpose. A flagged upload is held out of the gallery and shown only to the host, who approves or deletes it.",
        "Guests can also report a photo from inside the gallery. A reported photo is hidden at once and the host is emailed.",
      ],
    },
    {
      heading: "Why we are allowed to hold it",
      body: [
        "For host accounts and payments: because we need it to give you the service you asked for, and because tax law requires us to keep records of what was sold.",
        "For the photographs: on your instructions, as the controller. The lawful basis for collecting them from your guests is yours to have, and in practice it is the guest's own decision to upload.",
        "For the moderation check and the small number of counts we keep, meaning photos, uploaders and link opens: our legitimate interest in running a service that is not used for illegal content, and in knowing whether the product works. They are counts and category labels, never profiles.",
      ],
    },
    {
      heading: "Cookies",
      body: [
        "One cookie keeps you signed in. There is no advertising cookie, no analytics cookie, and no third-party tracker on any page of this site.",
        "The identifier stored in a guest's browser is not a cookie and is not sent to anyone else.",
      ],
    },
    {
      heading: "Who else touches the data",
      body: [
        "As few companies as we can manage. Each does one specific job, each is bound by a data processing agreement, and none may use anything for their own purposes:",
      ],
      list: [
        "Supabase - accounts and the database holding your events.",
        "Amazon Web Services - the photograph and video files themselves, stored in Frankfurt, and the automated moderation check.",
        "Vercel - running and serving the website.",
        "Lemon Squeezy - payment, as merchant of record. They hold your payment details and we never see them.",
        "Resend - sending the emails this product sends, such as the warnings before a storage window ends.",
      ],
    },
    {
      heading: "Where it is",
      body: [
        "Files are stored in the European Union and the moderation check runs in the same region, so no photograph leaves the EU.",
        "Some of the companies above are incorporated in the United States and may process account or billing data there. Where they do, the transfer runs on the European Commission's standard contractual clauses.",
      ],
    },
    {
      heading: "How long it stays",
      body: [
        `Photographs live as long as the event's storage window: ${TIERS.free.retentionDays} days on ${TIERS.free.name}, six months on ${TIERS.plus.name}, twelve months on ${TIERS.pro.name}, counted from the date of the event.`,
        `After that the event is paused for ${HARD_DELETE_GRACE_DAYS} days, during which nothing has been removed and the host can restore it. At the end of those ${HARD_DELETE_GRACE_DAYS} days the files are deleted permanently by a job that runs every day. With the ${KEEP_FOREVER.name} add-on they stay until the host deletes them.`,
        "Deleting an event deletes its files immediately. Your account stays until you ask us to close it, at which point it and everything in it goes, except the payment records tax law requires us to keep.",
      ],
    },
    {
      heading: "How it is protected",
      body: [
        "Files are encrypted at rest and everything travels over HTTPS. Share links are long random tokens, stored hashed, so a database leak does not hand over working links, and a revoked link stops working at once.",
        "Galleries are private. There is no public index, no browsable list of events, and no guessable id anywhere in a share link. Access to production data is limited to the people who need it to run the service.",
      ],
    },
    {
      heading: "Your rights",
      body: [
        "If you are in the EU or the UK you can ask us for a copy of what we hold about you, ask us to correct it, ask us to delete it, ask us to restrict or stop a particular use, object to it, and ask for it in a portable form.",
        `${CONTACT} We answer within a month, and usually the same week. Most of it you can also do yourself and faster: your gallery is your export, and deleting an event deletes its contents.`,
      ],
    },
    {
      heading: "If you appear in a photo and did not upload it",
      body: [
        "You have the same rights over that photograph as anyone else whose personal data is being processed, and you do not need an account to use them.",
        `Ask the host who gave you the link first, because they control the event and can delete any photo immediately. If you cannot reach them or they will not act, write to ${SITE.email} with the event and enough detail to find the photo. We will remove it within ${TAKEDOWN_RESPONSE_HOURS} hours and tell you when it is done.`,
      ],
    },
    {
      heading: "Children",
      body: [
        "The service is not directed at children and we do not knowingly collect data from them directly.",
        `Children do appear in event photographs. Uploading a photo of a child without their guardian's permission is not allowed, a guardian who wants one removed can use the same route as anyone else, and we treat those requests as urgent rather than waiting the full ${TAKEDOWN_RESPONSE_HOURS} hours.`,
      ],
    },
    {
      heading: "Complaints",
      body: [
        "If we have got something wrong, tell us first. You also have the right to complain to the data protection authority where you live, or to the Commissioner for Information of Public Importance and Personal Data Protection in Serbia.",
      ],
    },
    {
      heading: "Changes to this policy",
      body: [
        "If we change it in a way that matters, we will email the address on your account. The date at the top of this page always says when it last changed.",
      ],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/*  Refunds                                                                    */
/* -------------------------------------------------------------------------- */

const REFUND_POLICY: LegalPage = {
  slug: "refund-policy",
  title: "Refund Policy",
  navLabel: "Refunds",
  intro:
    "A one-time purchase tied to a date that has probably already passed is the hardest kind of refund to write rules for. So the rules are short, and they lean towards the buyer.",
  sections: [
    {
      heading: "The window",
      body: [
        "Fourteen days from the moment you pay. Inside that window, ask and you get your money back.",
        "You do not have to explain why, you do not have to prove you did not use it, and there is no fee, no partial refund and no credit instead of cash. It goes back to the card you paid with.",
      ],
    },
    {
      heading: "If your event has already happened",
      body: [
        "This is the case a one-time event purchase always runs into, so it gets a plain answer rather than silence.",
        "If the software did not do its job, meaning uploads failed, the gallery did not load, the QR code did not work, or you could not download your photos, you get a full refund whether or not the event has taken place and whether or not the fourteen days have run out. Write to us and tell us what happened.",
        "If the software worked and you simply no longer need it, the fourteen days apply as they do to anything else. After a wedding that went fine and a gallery full of photos you downloaded, we will normally say no, and we would rather tell you that here than discover it together later.",
      ],
    },
    {
      heading: "The consumer right you have anyway",
      body: [
        "EU and UK consumers have fourteen days to withdraw from a distance contract. Digital content delivered immediately is an exception to that, and by buying an upgrade that unlocks the moment payment lands you agree to immediate delivery and accept that the statutory withdrawal right falls away.",
        "The fourteen-day window above is our own promise, given voluntarily, and it does not depend on that statutory right. We would rather give the money back than argue about which of the two applies.",
      ],
    },
    {
      heading: "Keep Forever",
      body: [
        `${KEEP_FOREVER.name} is a one-time payment of €${KEEP_FOREVER.priceEur} that removes the storage window on an event. The same fourteen days apply.`,
        "Refunding it puts the event back on the storage window of its plan. Nothing is deleted on the day of the refund, and the usual warning emails run before anything is.",
      ],
    },
    {
      heading: "How to ask",
      body: [
        `Email ${SITE.email} from the address on your account. Tell us the name of the event and, if something went wrong, roughly when.`,
        "There is no form to fill in and no ticket number to quote. We answer within two working days. The money is back with your bank five to ten days after that, which is their timing rather than ours.",
      ],
    },
    {
      heading: "What happens to your photos",
      body: [
        "A refunded upgrade returns the event to the plan it was on before, which usually means less storage and a shorter window rather than immediate deletion.",
        "If that would put the event over its storage limit, nothing is removed automatically. You keep read access and the ZIP download so you can get your photos out first, and we tell you the date the retention job will act.",
      ],
    },
    {
      heading: "Chargebacks",
      body: [
        "Please write to us before opening a dispute with your bank. A chargeback takes weeks, costs us a fee, and gets you the same money more slowly than an email would.",
        "If you have already opened one, tell us anyway. We will not contest a refund we would have given you.",
      ],
    },
    {
      heading: "Who is refunding you",
      body: [
        `Payments are taken by Lemon Squeezy as merchant of record, so the charge on your statement and the refund both come from them. The decision is ours. ${OPERATOR_LINE}`,
      ],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/*  Acceptable use                                                             */
/* -------------------------------------------------------------------------- */

const ACCEPTABLE_USE: LegalPage = {
  slug: "acceptable-use",
  title: "Acceptable Use Policy",
  navLabel: "Acceptable use",
  intro:
    "This product hands a link to a room full of people and lets them upload from their phones. These are the rules that come with that, and they bind the host and every guest the link reaches.",
  sections: [
    {
      heading: "What may never be uploaded",
      body: ["None of the following, ever, on any plan:"],
      list: [
        "Anything illegal under the law of Serbia, the European Union, or the country the upload came from.",
        "Sexual content of any kind, including nudity, whether or not everyone in it consented.",
        "Any sexual content involving a minor, or any content that sexualises a child. This is reported to the authorities, not merely deleted.",
        "Photographs of people who have not consented to being photographed and shared.",
        "Photographs of a child taken or shared without their parent or guardian's permission.",
        "Violence, cruelty, abuse, or content that exists to degrade or harass somebody.",
        "Hate speech, or material promoting terrorism or violent extremism.",
        "Someone else's copyrighted work that you have no right to share.",
        "Images used to pass on personal data, such as identity papers, cards, or passwords.",
        "Malware, or files crafted to attack the service or the people using it.",
      ],
    },
    {
      heading: "Consent is the host's job",
      body: [
        "Anyone in a photograph has a say in whether it is shared, and gathering that agreement is the host's responsibility, not ours and not the guest's.",
        "Guests are shown a line before they upload, confirming they have permission from the people pictured. It is a reminder, not a transfer of responsibility.",
        "If somebody at your event asks not to be photographed, that is the end of it. Delete the photo. The dashboard removes any single upload, and the event can be switched to hold every upload for your approval before it appears to anyone.",
      ],
    },
    {
      heading: "What we do about it",
      body: [
        "Every photo is screened automatically the moment it arrives, before it appears in any gallery. A flagged upload is held back and shown only to the host, who approves or deletes it. Video is screened on a still frame from the clip.",
        "Guests can report any photo from inside the gallery. A reported photo is hidden immediately, before anyone has looked at it, and the host is emailed.",
        "Automated screening is not perfect in either direction. It is one layer, and the host controls and the report button are the others.",
      ],
    },
    {
      heading: "Reporting something",
      body: [
        "Inside a gallery, use the report button on the photo. It is the fastest route and it hides the photo at once.",
        `From outside, or for anything serious, email ${SITE.email}. Include the event link or name, and enough description to identify the photo. You do not need an account and you do not need to be the host.`,
        `We answer every report within ${TAKEDOWN_RESPONSE_HOURS} hours. Anything involving a child, or anything that looks illegal, is handled immediately rather than in turn.`,
      ],
    },
    {
      heading: "If you appear in a photo and want it gone",
      body: [
        `Ask the host first, because they can delete it in seconds. If you cannot reach them, write to ${SITE.email} and we will remove it within ${TAKEDOWN_RESPONSE_HOURS} hours.`,
        "You do not have to explain your reasons, and for an ordinary request you do not have to prove who you are.",
      ],
    },
    {
      heading: "What we will do to an account that breaks this",
      body: [
        "Depending on what happened: remove the photo, hide the gallery, suspend the event, revoke the share link, close the account, or report it to the police.",
        "Anything involving a child goes to the authorities and the account is closed. There is no warning step for that.",
        "For everything else we will tell you what was removed and why, and you can reply. Honest mistakes at a party are common and we treat them as mistakes.",
      ],
    },
    {
      heading: "Do not attack the service",
      body: [
        "No scraping galleries, no guessing share links, no attempting to reach an event you were not given, no probing for holes, and no automated uploading.",
        "Share links are long random tokens precisely so guessing does not work. Trying anyway is a breach of this policy whether or not it succeeds.",
      ],
    },
    {
      heading: "Who to reach",
      body: [
        `Reports, takedowns and anything urgent: ${SITE.email}. We answer within ${TAKEDOWN_RESPONSE_HOURS} hours.`,
        `Postal address: ${OPERATOR.legalName}, ${addressLine()}.`,
      ],
    },
  ],
};

/* -------------------------------------------------------------------------- */

export const LEGAL_PAGES: Record<LegalSlug, LegalPage> = {
  terms: TERMS,
  privacy: PRIVACY,
  "refund-policy": REFUND_POLICY,
  "acceptable-use": ACCEPTABLE_USE,
};

/**
 * The order they appear in the footer, and the order a reviewer scans them.
 * Terms first, because it is the one that names the operator.
 */
export const LEGAL_ORDER: LegalSlug[] = [
  "terms",
  "privacy",
  "refund-policy",
  "acceptable-use",
];
