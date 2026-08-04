import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Where an emailed link lands.
 *
 * Confirmation and recovery links carry a token hash, not an OAuth code, so
 * this cannot share auth/callback. It also must not: exchangeCodeForSession
 * needs the PKCE verifier cookie left by the browser that started the flow,
 * which is missing when someone signs up on a laptop and opens the email on a
 * phone. verifyOtp has no such requirement.
 */
const ALLOWED: readonly EmailOtpType[] = [
  "signup",
  "email",
  "recovery",
  "invite",
  "email_change",
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  // Only ever redirect within our own site.
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  const supabase = await createClient();

  /**
   * Two shapes arrive here, and which one depends on a dashboard setting no
   * deploy can see. Supabase's stock templates send the reader through its own
   * /auth/v1/verify, which hands us a `code`; templates edited to use
   * {{ .TokenHash }} hand us a token hash instead. Accepting only the second
   * would make editing those templates a silent prerequisite, and the failure
   * would look like a broken link rather than a missing setup step.
   */
  if (!tokenHash && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL("/login?error=expired_link", url.origin),
      );
    }
    return NextResponse.redirect(
      new URL(
        type === "recovery" ? "/account/password" : (safeNext ?? "/dashboard"),
        url.origin,
      ),
    );
  }

  if (!tokenHash || !type || !ALLOWED.includes(type)) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_link", url.origin),
    );
  }

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=expired_link", url.origin),
    );
  }

  // A recovery link exists for one purpose. Honouring `next` here would let a
  // reset email be turned into a link that quietly lands somewhere else.
  const destination =
    type === "recovery" ? "/account/password" : (safeNext ?? "/dashboard");

  return NextResponse.redirect(new URL(destination, url.origin));
}
