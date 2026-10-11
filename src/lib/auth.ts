import { z } from "zod";

// Supabase's own floor is 6. Eight costs a host nothing.
export const MIN_PASSWORD_LENGTH = 8;

// bcrypt ignores everything past 72 bytes, so accepting more is a quiet lie.
const MAX_PASSWORD_LENGTH = 72;

const MAX_NAME_LENGTH = 120;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address.")
  .email("That does not look like an email address.");

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(MAX_PASSWORD_LENGTH, "That password is too long.");

/** Signing in deliberately skips the length rule: accounts predate it. */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: z
    .string()
    .trim()
    .max(MAX_NAME_LENGTH, "That name is too long.")
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const resetRequestSchema = z.object({ email: emailSchema });

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "Those two passwords do not match.",
    path: ["confirm"],
  });

export const CREDENTIALS_MESSAGE = "That email and password don't match.";

// Returned whether or not the address exists, so replies cannot enumerate accounts.
export const RESET_SENT_MESSAGE =
  "If that address has an account, a reset link is on its way.";

export const CHECK_INBOX_MESSAGE =
  "Check your inbox - we sent a link to confirm your address.";

export const GENERIC_MESSAGE = "Something went wrong. Try again.";

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: CREDENTIALS_MESSAGE,
  email_not_confirmed:
    "Confirm your email address first - the link is in your inbox.",
  over_request_rate_limit: "Too many attempts. Wait a minute and try again.",
  over_email_send_rate_limit:
    "Too many emails sent to that address. Wait a few minutes.",
  weak_password: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  same_password: "That is already your password. Pick a different one.",
  // Supabase reports this only when confirmation is off; when it is on, sign-up
  // succeeds silently.
  user_already_exists: CHECK_INBOX_MESSAGE,
  signup_disabled: "New accounts are closed at the moment.",
};

export function authErrorMessage(
  error: { code?: string } | null | undefined,
): string {
  const code = error?.code;
  return (code && AUTH_MESSAGES[code]) || GENERIC_MESSAGE;
}

const LINK_MESSAGES: Record<string, string> = {
  invalid_link: "That link is not valid. Ask for a new one.",
  expired_link: "That link has expired or was already used. Ask for a new one.",
  session_expired: "Your session expired. Sign in again.",
  missing_code: "Sign-in did not finish. Try again.",
};

export function loginErrorMessage(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return LINK_MESSAGES[code] ?? code;
}
