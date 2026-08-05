import "server-only";

import { env } from "@/lib/env";

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
  return `<div style="background:#FFF6DC;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:#1F1607">
  <div style="max-width:520px;margin:0 auto;background:#FFFDF4;border:2px solid #1F1607;border-radius:20px;padding:32px">
    <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:3px;color:#B0670F;text-transform:uppercase">Say Cheese</div>
    ${body}
    ${
      cta
        ? `<p style="margin:28px 0 0"><a href="${cta.url}" style="display:inline-block;background:#1F1607;color:#FFF6DC;text-decoration:none;padding:13px 22px;border-radius:12px;font-weight:700">${cta.label}</a></p>`
        : ""
    }
  </div>
  <p style="max-width:520px;margin:16px auto 0;font-size:13px;color:#B0670F">Every photo from every guest, at any event.</p>
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
    <p style="font-size:16px;line-height:1.6">Download everything as a ZIP now, or add <strong>The Cellar</strong> and keep them permanently for a single €29 payment. Not per year - once.</p>`;

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
    <p style="font-size:16px;line-height:1.6">Your photos sit in a holding state for <strong>${args.graceDays} more days</strong>. Restore the event or add The Cellar within that window and everything comes straight back.</p>`;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
