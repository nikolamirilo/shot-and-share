"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  CHECK_INBOX_MESSAGE,
  RESET_SENT_MESSAGE,
  authErrorMessage,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/auth";
import { env } from "@/lib/env";
import { LIMITS, clientIp, rateLimit } from "@/lib/ratelimit";
import { createClient } from "@/lib/supabase/server";

export interface AuthState {
  error?: string;
  notice?: string;
}

/** Only ever redirect within our own site. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

async function throttled(
  bucket: "signIn" | "signUp" | "passwordReset",
): Promise<boolean> {
  const { limit, window } = LIMITS[bucket];
  return !rateLimit(`${bucket}:${clientIp(await headers())}`, limit, window).ok;
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (await throttled("signIn")) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error) };

  // Outside any try/catch: redirect() works by throwing.
  redirect(safeNext(formData.get("next")));
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    // FormData yields null for an absent field; zod's .optional() wants undefined.
    full_name: formData.get("full_name") ?? undefined,
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (await throttled("signUp")) {
    return { error: "Too many sign-ups from this network. Try again later." };
  }

  const next = safeNext(formData.get("next"));
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Read by the on_auth_user_created trigger, which fills profiles.full_name.
      data: parsed.data.full_name
        ? { full_name: parsed.data.full_name }
        : undefined,
      emailRedirectTo: `${env.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) return { error: authErrorMessage(error) };

  // A session comes back only when email confirmation is switched off in the
  // Supabase dashboard. Branching on the response rather than on configuration
  // means the toggle can move either way without a code change.
  if (data.session) redirect(next);

  return { notice: CHECK_INBOX_MESSAGE };
}

export async function requestReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Every path below returns the same sentence. A throttle reply that differed
  // from a success reply would confirm an address just as loudly as an error.
  if (await throttled("passwordReset")) return { notice: RESET_SENT_MESSAGE };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl}/auth/confirm`,
  });

  return { notice: RESET_SENT_MESSAGE };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The recovery link established this session. Without one there is nothing
  // to update, and no way to tell whose password was meant.
  if (!user) redirect("/login?error=session_expired");

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: authErrorMessage(error) };

  redirect("/dashboard");
}
