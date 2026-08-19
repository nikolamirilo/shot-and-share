import "server-only";

import { env } from "@/lib/env";
import { KEEP_FOREVER } from "@/lib/tiers";

/**
 * Transactional email. Without an API key it logs instead of sending, so the
 * retention job can be run and inspected in development without a provider.
 *
 * The warning emails are not a nicety. "Losing someone's wedding photos" is the
 * failure this product cannot survive, and the warnings are the part of the
 * retention system the customer actually sees.
 */

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(email: Email): Promise<boolean> {
  if (!env.resendApiKey) {
    console.info(
      `[email:dry-run] to=${email.to} subject=${JSON.stringify(email.subject)}`,
    );
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!res.ok) {
    console.error("[email] send failed", res.status, await res.text());
    return false;
  }
  return true;
}

function layout(body: string, cta?: { label: string; url: string }): string {
  return `<div style="background:#F6F2F3;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:#181214">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #DCD1D3;border-radius:16px;padding:32px">
    <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:3px;color:#8B7D80;text-transform:uppercase">Shot & Share</div>
    ${body}
    ${
      cta
        ? `<p style="margin:28px 0 0"><a href="${cta.url}" style="display:inline-block;background:#7A1230;color:#FDF6F7;text-decoration:none;padding:13px 22px;border-radius:16px;font-weight:700">${cta.label}</a></p>`
        : ""
    }
  </div>
  <p style="max-width:520px;margin:16px auto 0;font-size:13px;color:#8B7D80">Every photo your guests take.</p>
</div>`;
}

export function retentionWarningEmail(args: {
  to: string;
  eventName: string;
  days: number;
  photoCount: number;
  downloadUrl: string;
}): Email {
  const when =
    args.days === 1 ? "tomorrow" : `in ${args.days} days`;

  const subject = `${args.eventName}: your photos are deleted ${when}`;
  const body = `
    <h1 style="font-size:27px;margin:14px 0 12px;line-height:1.15">Your photos come down ${when}</h1>
    <p style="font-size:16px;line-height:1.6">You collected <strong>${args.photoCount}</strong> ${args.photoCount === 1 ? "photo" : "photos"} at <strong>${escapeHtml(args.eventName)}</strong>. The storage window for this event ends ${when}.</p>
    <p style="font-size:16px;line-height:1.6">Download everything as a ZIP now, or add <strong>${KEEP_FOREVER.name}</strong> and keep them permanently for a single €${KEEP_FOREVER.priceEur} payment. Not per year - once.</p>`;

  const text = `Your photos for ${args.eventName} are deleted ${when}. Download them: ${args.downloadUrl}`;
  return { to: args.to, subject, html: layout(body, { label: "Download my photos", url: args.downloadUrl }), text };
}

export function eventExpiredEmail(args: {
  to: string;
  eventName: string;
  graceDays: number;
  restoreUrl: string;
}): Email {
  const subject = `${args.eventName}: photos scheduled for deletion`;
  const body = `
    <h1 style="font-size:27px;margin:14px 0 12px;line-height:1.15">We have paused, not deleted</h1>
    <p style="font-size:16px;line-height:1.6">The storage window for <strong>${escapeHtml(args.eventName)}</strong> has ended. Nothing has been removed yet.</p>
    <p style="font-size:16px;line-height:1.6">Your photos sit in a holding state for <strong>${args.graceDays} more days</strong>. Restore the event or add ${KEEP_FOREVER.name} within that window and everything comes straight back.</p>`;
  const text = `The storage window for ${args.eventName} ended. Nothing is deleted for ${args.graceDays} days: ${args.restoreUrl}`;
  return { to: args.to, subject, html: layout(body, { label: "Restore this event", url: args.restoreUrl }), text };
}

export function eventReadyEmail(args: {
  to: string;
  eventName: string;
  shareUrl: string;
}): Email {
  const subject = `${args.eventName} is ready to collect photos`;
  const body = `
    <h1 style="font-size:27px;margin:14px 0 12px;line-height:1.15">Your event is live</h1>
    <p style="font-size:16px;line-height:1.6">Print the QR code, put it on the tables, and every guest can hand you their photos in about twenty seconds. No app, no account.</p>
    <p style="font-family:ui-monospace,monospace;font-size:14px;color:#7A4409;word-break:break-all">${escapeHtml(args.shareUrl)}</p>`;
  const text = `${args.eventName} is ready. Share this link: ${args.shareUrl}`;
  return { to: args.to, subject, html: layout(body, { label: "Open my event", url: args.shareUrl }), text };
}

/**
 * A guest pressed report and the photograph is already hidden.
 *
 * Sent at once rather than batched, because the only person who can put it back
 * or delete it for good is the host, and until they look the wall is one photo
 * short. The reason is the guest's own words from a short list, so it says
 * "someone in it" rather than a category id.
 */
export function photoReportedEmail(args: {
  to: string;
  eventId: string;
  eventName: string;
  reason: string;
  reviewUrl: string;
}): Email {
  const said: Record<string, string> = {
    not_allowed: "it should not be here",
    someone_in_it: "somebody in it did not want it shared",
    mistake: "it was uploaded by mistake",
    other: "no reason given",
  };

  const subject = `${args.eventName}: a guest reported a photo`;
  const body = `
    <h1 style="font-size:27px;margin:14px 0 12px;line-height:1.15">One photo is hidden</h1>
    <p style="font-size:16px;line-height:1.6">A guest at <strong>${escapeHtml(args.eventName)}</strong> reported a photo, and it came off the gallery straight away. Nobody else can see it.</p>
    <p style="font-size:16px;line-height:1.6">They said <strong>${escapeHtml(said[args.reason] ?? said.other)}</strong>.</p>
    <p style="font-size:16px;line-height:1.6">Have a look and either put it back or delete it. Nothing else on the event has changed.</p>`;
  const text = `A guest reported a photo at ${args.eventName}. It is hidden until you look: ${args.reviewUrl}`;
  return {
    to: args.to,
    subject,
    html: layout(body, { label: "Review this photo", url: args.reviewUrl }),
    text,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
