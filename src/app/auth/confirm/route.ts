import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

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

  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  const supabase = await createClient();

  /**
   * Supabase's stock templates verify through its own endpoint and hand us a
   * `code`; templates edited to use {{ .TokenHash }} hand us a token hash.
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

  // A recovery link must not honour `next`, or a reset email becomes an open redirect.
  const destination =
    type === "recovery" ? "/account/password" : (safeNext ?? "/dashboard");

  return NextResponse.redirect(new URL(destination, url.origin));
}
