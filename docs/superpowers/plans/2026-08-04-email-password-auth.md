# Email + Password Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let hosts sign in, sign up, and reset a password with an email address and password through Supabase Auth, next to the existing Google button.

**Architecture:** All credential handling runs in Next.js server actions (`src/app/login/actions.ts`) against the cookie-backed Supabase server client, so passwords never reach client JS and the existing in-process rate limiter applies. Input rules live in a Supabase-free module (`src/lib/auth.ts`) so they are unit-testable. Emailed confirmation and recovery links land on a new `/auth/confirm` route that calls `verifyOtp`; the Google `/auth/callback` route is not touched.

**Tech Stack:** Next.js 15 App Router, React 19 (`useActionState` / `useFormStatus`), `@supabase/ssr` 0.12, `@supabase/supabase-js` 2.47, zod 3, Tailwind 4, Vitest 2.

**Spec:** `docs/superpowers/specs/2026-08-04-email-password-auth-design.md`

## Global Constraints

- **Do not modify `src/app/auth/callback/route.ts`.** The Google sign-in bug is explicitly out of scope for this work.
- **Do not modify the `config.matcher` in `src/middleware.ts`.** Its existing pattern already covers `/account` and `/login`.
- Minimum password length is **8** characters. Supabase's own default floor is 6; the app asks for more.
- Maximum password length is **72** bytes - Supabase hashes with bcrypt, which silently truncates past that.
- A failed sign-in **always** reads `That email and password don't match.` Never a message that distinguishes "wrong password" from "no such account".
- A password-reset request **always** replies `If that address has an account, a reset link is on its way.` - on success, on failure, and when rate-limited.
- Raw Supabase error strings are never rendered. Everything goes through `authErrorMessage()`.
- Redirect targets from user input must start with a single `/`, matching the `safeNext` check already in `src/app/auth/callback/route.ts:15`.
- Follow the house server-action pattern in `src/app/dashboard/actions.ts`: zod `safeParse`, a plain state object return, `redirect()` on success.
- This repo has **no React testing library**. Only `src/lib/auth.ts` gets unit tests (Task 1). Every other task is gated on `npm run typecheck && npm run lint && npm run build` plus the manual checks listed in that task.
- Use `npm`, not yarn or pnpm.

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/lib/auth.ts` | zod schemas, message constants, error mapping. No Supabase import. |
| `tests/auth.test.ts` | Unit tests for the above |
| `src/app/login/actions.ts` | `signIn`, `signUp`, `requestReset`, `updatePassword` server actions |
| `src/app/login/email-form.tsx` | Client form with sign-in / create-account toggle |
| `src/app/auth/confirm/route.ts` | `verifyOtp` for emailed links |
| `src/app/login/forgot/page.tsx` | Reset-request page shell |
| `src/app/login/forgot/forgot-form.tsx` | Reset-request client form |
| `src/app/account/password/page.tsx` | Set-new-password page shell, requires a session |
| `src/app/account/password/password-form.tsx` | Set-new-password client form |

**Modify:**

| File | Change |
|---|---|
| `src/lib/ratelimit.ts` | Three new entries in `LIMITS` |
| `src/app/login/login-panel.tsx` | Compose in `EmailForm`, demote Google to `secondary` |
| `src/app/login/page.tsx` | Map error codes through `loginErrorMessage()` |
| `.env.example` | Add `NEXT_PUBLIC_SITE_URL` and the renamed Supabase key variables |
| `README.md` | Email/password setup steps, email-template change |

---

### Task 1: Validation rules and error messages

The only task with unit tests. Everything downstream imports from here, so it goes first.

**Files:**
- Create: `src/lib/auth.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `MIN_PASSWORD_LENGTH: number`, `emailSchema`, `passwordSchema`, `signInSchema`, `signUpSchema`, `resetRequestSchema`, `updatePasswordSchema` (all zod schemas), `CREDENTIALS_MESSAGE`, `RESET_SENT_MESSAGE`, `CHECK_INBOX_MESSAGE`, `GENERIC_MESSAGE` (all `string`), `authErrorMessage(error: { code?: string } | null | undefined): string`, `loginErrorMessage(code: string | undefined): string | undefined`

- [ ] **Step 1: Write the failing test**

Create `tests/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  CHECK_INBOX_MESSAGE,
  CREDENTIALS_MESSAGE,
  GENERIC_MESSAGE,
  MIN_PASSWORD_LENGTH,
  authErrorMessage,
  loginErrorMessage,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/auth";

describe("email", () => {
  it("normalises case and surrounding space", () => {
    const parsed = signInSchema.parse({
      email: "  Host@Example.COM ",
      password: "whatever",
    });
    expect(parsed.email).toBe("host@example.com");
  });

  it("rejects a string that is not an address", () => {
    const result = signInSchema.safeParse({
      email: "not-an-address",
      password: "whatever",
    });
    expect(result.success).toBe(false);
  });
});

describe("password", () => {
  it("requires the minimum only when creating an account", () => {
    // An account made before this rule existed may have a six-character
    // password. Signing in must not lock those people out.
    expect(signInSchema.safeParse({ email: "a@b.com", password: "abc123" }).success).toBe(true);
    expect(signUpSchema.safeParse({ email: "a@b.com", password: "abc123" }).success).toBe(false);
  });

  it("accepts a password at the minimum length", () => {
    const password = "a".repeat(MIN_PASSWORD_LENGTH);
    expect(signUpSchema.safeParse({ email: "a@b.com", password }).success).toBe(true);
  });

  it("rejects a password past the bcrypt truncation point", () => {
    // Supabase hashes with bcrypt, which ignores everything past 72 bytes.
    // Accepting a longer one would silently make the tail meaningless.
    const password = "a".repeat(73);
    expect(signUpSchema.safeParse({ email: "a@b.com", password }).success).toBe(false);
  });

  it("requires a non-empty password to sign in", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("sign-up name", () => {
  it("is optional", () => {
    const result = signUpSchema.safeParse({ email: "a@b.com", password: "12345678" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.full_name).toBeUndefined();
  });

  it("trims, and treats blank as absent", () => {
    const result = signUpSchema.parse({
      email: "a@b.com",
      password: "12345678",
      full_name: "  Ana Marić  ",
    });
    expect(result.full_name).toBe("Ana Marić");

    const blank = signUpSchema.parse({
      email: "a@b.com",
      password: "12345678",
      full_name: "   ",
    });
    expect(blank.full_name).toBeUndefined();
  });

  it("rejects a name longer than the profiles column expects", () => {
    const result = signUpSchema.safeParse({
      email: "a@b.com",
      password: "12345678",
      full_name: "x".repeat(121),
    });
    expect(result.success).toBe(false);
  });
});

describe("update password", () => {
  it("requires both entries to match", () => {
    expect(
      updatePasswordSchema.safeParse({ password: "12345678", confirm: "12345678" }).success,
    ).toBe(true);
    expect(
      updatePasswordSchema.safeParse({ password: "12345678", confirm: "87654321" }).success,
    ).toBe(false);
  });
});

describe("reset request", () => {
  it("only needs an address", () => {
    expect(resetRequestSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });
});

describe("authErrorMessage", () => {
  it("gives one sentence for a wrong password and for an unknown address", () => {
    // Two different failures, one message. Anything else lets a stranger test
    // whether an address has an account here.
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe(CREDENTIALS_MESSAGE);
  });

  it("treats an existing address at sign-up as an ordinary inbox check", () => {
    expect(authErrorMessage({ code: "user_already_exists" })).toBe(CHECK_INBOX_MESSAGE);
  });

  it("never leaks an unrecognised provider error", () => {
    expect(authErrorMessage({ code: "some_new_supabase_code" })).toBe(GENERIC_MESSAGE);
    expect(authErrorMessage(null)).toBe(GENERIC_MESSAGE);
  });
});

describe("loginErrorMessage", () => {
  it("turns a link failure into a sentence", () => {
    expect(loginErrorMessage("expired_link")).toMatch(/expired/i);
  });

  it("passes through what the OAuth callback already puts in the query", () => {
    // auth/callback puts a provider message in ?error=. Keep showing it.
    expect(loginErrorMessage("Google said no")).toBe("Google said no");
  });

  it("returns undefined when there is no error", () => {
    expect(loginErrorMessage(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/auth.test.ts
```

Expected: FAIL - `Failed to resolve import "@/lib/auth"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/auth.ts`:

```ts
/**
 * What counts as a valid credential, and what we say when one is not.
 *
 * No Supabase import lives here on purpose: the rules are the part worth
 * testing, and they should be testable without a project, a network, or a
 * session. The actions in src/app/login/actions.ts are the only place the two
 * halves meet.
 */

import { z } from "zod";

/** Supabase's own floor is 6. Eight costs a host nothing and is meaningfully better. */
export const MIN_PASSWORD_LENGTH = 8;

/** bcrypt ignores everything past 72 bytes, so accepting more is a quiet lie. */
const MAX_PASSWORD_LENGTH = 72;

/** Matches the length the profiles.full_name column is used with elsewhere. */
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

/**
 * Signing in deliberately does not apply the length rule. An account created
 * before the rule existed still has to be able to get in.
 */
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

/* -------------------------------------------------------------------------- */

/** Shown for a wrong password and for an address with no account alike. */
export const CREDENTIALS_MESSAGE = "That email and password don't match.";

/** Returned whether or not the address exists, so replies cannot enumerate accounts. */
export const RESET_SENT_MESSAGE =
  "If that address has an account, a reset link is on its way.";

export const CHECK_INBOX_MESSAGE =
  "Check your inbox - we sent a link to confirm your address.";

export const GENERIC_MESSAGE = "Something went wrong. Try again.";

/**
 * Supabase error codes we have a sentence for. An unmapped code falls back to
 * GENERIC_MESSAGE rather than rendering the provider's own wording, which
 * changes without notice and occasionally says more than a stranger should see.
 */
const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: CREDENTIALS_MESSAGE,
  email_not_confirmed:
    "Confirm your email address first - the link is in your inbox.",
  over_request_rate_limit: "Too many attempts. Wait a minute and try again.",
  over_email_send_rate_limit:
    "Too many emails sent to that address. Wait a few minutes.",
  weak_password: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  same_password: "That is already your password. Pick a different one.",
  // Supabase reports this only when confirmation is off; when it is on, the
  // sign-up call succeeds silently for exactly this reason.
  user_already_exists: CHECK_INBOX_MESSAGE,
  signup_disabled: "New accounts are closed at the moment.",
};

export function authErrorMessage(
  error: { code?: string } | null | undefined,
): string {
  const code = error?.code;
  return (code && AUTH_MESSAGES[code]) || GENERIC_MESSAGE;
}

/** Codes this app puts in `/login?error=`. */
const LINK_MESSAGES: Record<string, string> = {
  invalid_link: "That link is not valid. Ask for a new one.",
  expired_link: "That link has expired or was already used. Ask for a new one.",
  session_expired: "Your session expired. Sign in again.",
  missing_code: "Sign-in did not finish. Try again.",
};

/**
 * The OAuth callback puts a provider message in the query string rather than a
 * code, so anything unrecognised is passed through unchanged.
 */
export function loginErrorMessage(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return LINK_MESSAGES[code] ?? code;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- tests/auth.test.ts
```

Expected: PASS, all tests green.

- [ ] **Step 5: Typecheck and lint**

```bash
npm run typecheck && npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts tests/auth.test.ts
git commit -m "Add auth validation rules and non-enumerating error messages"
```

---

### Task 2: Server actions and their rate limits

**Files:**
- Create: `src/app/login/actions.ts`
- Modify: `src/lib/ratelimit.ts:58-67` (the `LIMITS` object)

**Interfaces:**
- Consumes: everything Task 1 produces; `createClient()` from `@/lib/supabase/server`; `LIMITS`, `clientIp`, `rateLimit` from `@/lib/ratelimit`; `env.siteUrl` from `@/lib/env`
- Produces: `interface AuthState { error?: string; notice?: string }`, and four actions each typed `(prev: AuthState, formData: FormData) => Promise<AuthState>`: `signIn`, `signUp`, `requestReset`, `updatePassword`

- [ ] **Step 1: Add the rate-limit buckets**

In `src/lib/ratelimit.ts`, add three entries to the end of the `LIMITS` object, keeping the existing comment style:

```ts
  /** Sign-in attempts per IP. Low enough to blunt credential stuffing. */
  signIn: { limit: 10, window: 300 },
  /** Sign-ups per IP, per hour. */
  signUp: { limit: 5, window: 3600 },
  /** Reset emails per IP, per hour. Supabase throttles per address; this
   *  throttles the sender, which is the part an attacker controls. */
  passwordReset: { limit: 5, window: 3600 },
```

- [ ] **Step 2: Write the actions**

Create `src/app/login/actions.ts`:

```ts
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
```

- [ ] **Step 3: Typecheck and lint**

```bash
npm run typecheck && npm run lint
```

Expected: no errors. If TypeScript complains that a code path returns `undefined`, confirm `redirect()` is the last statement in that branch - its return type is `never`, which satisfies the signature.

- [ ] **Step 4: Verify the existing test suite still passes**

```bash
npm test
```

Expected: PASS. `tests/ratelimit.test.ts` covers the limiter; the new `LIMITS` entries must not break it.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/actions.ts src/lib/ratelimit.ts
git commit -m "Add email and password auth server actions"
```

---

### Task 3: The confirmation route for emailed links

**Files:**
- Create: `src/app/auth/confirm/route.ts`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server`
- Produces: a `GET` handler at `/auth/confirm` accepting `token_hash`, `type`, and optional `next`; redirects to `/account/password` for `type=recovery`, otherwise to `next` or `/dashboard`; redirects to `/login?error=invalid_link` or `/login?error=expired_link` on failure

- [ ] **Step 1: Write the route**

Create `src/app/auth/confirm/route.ts`:

```ts
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
  const next = url.searchParams.get("next");

  // Only ever redirect within our own site.
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  if (!tokenHash || !type || !ALLOWED.includes(type)) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_link", url.origin),
    );
  }

  const supabase = await createClient();
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
```

- [ ] **Step 2: Typecheck and lint**

```bash
npm run typecheck && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Verify the route answers**

```bash
npm run dev
```

In a second terminal:

```bash
curl -sI "http://localhost:3000/auth/confirm" | grep -i location
curl -sI "http://localhost:3000/auth/confirm?token_hash=nonsense&type=recovery" | grep -i location
```

Expected: the first redirects to `/login?error=invalid_link`, the second to `/login?error=expired_link`. Stop the dev server afterwards.

- [ ] **Step 4: Commit**

```bash
git add src/app/auth/confirm/route.ts
git commit -m "Add /auth/confirm for emailed confirmation and recovery links"
```

---

### Task 4: The email form on the login page

**Files:**
- Create: `src/app/login/email-form.tsx`
- Modify: `src/app/login/login-panel.tsx` (whole file)
- Modify: `src/app/login/page.tsx:17` and `:53`

**Interfaces:**
- Consumes: `signIn`, `signUp`, `AuthState` from `@/app/login/actions`; `MIN_PASSWORD_LENGTH`, `loginErrorMessage` from `@/lib/auth`; `Button`, `Field`, `inputClass` from `@/components/ui`
- Produces: `EmailForm({ next }: { next?: string })`

- [ ] **Step 1: Write the form component**

Create `src/app/login/email-form.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { signIn, signUp, type AuthState } from "@/app/login/actions";
import { Button, Field, inputClass } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";

/**
 * One form, two modes. A separate /signup route would duplicate the whole page
 * around a form that differs by a single field.
 *
 * The two modes keep separate action state so that switching between them does
 * not carry the other one's error along.
 */
export function EmailForm({ next }: { next?: string }) {
  const [creating, setCreating] = useState(false);
  const [signInState, signInAction] = useActionState<AuthState, FormData>(
    signIn,
    {},
  );
  const [signUpState, signUpAction] = useActionState<AuthState, FormData>(
    signUp,
    {},
  );

  const state = creating ? signUpState : signInState;

  // A sent confirmation email is the end of the road for this form: there is
  // nothing useful left to type until the link is clicked.
  if (signUpState.notice) {
    return (
      <div className="rounded-xl border-2 border-pepper bg-cream p-4">
        <p className="text-[0.9375rem] font-semibold">{signUpState.notice}</p>
        <p className="mt-2 text-[0.9375rem] text-crust">
          Nothing there after a minute? Check the spam folder.
        </p>
      </div>
    );
  }

  return (
    <form
      action={creating ? signUpAction : signInAction}
      className="space-y-4"
      key={creating ? "signup" : "signin"}
    >
      {next && <input type="hidden" name="next" value={next} />}

      {creating && (
        <Field label="Name" htmlFor="full_name" hint="Optional.">
          <input
            id="full_name"
            name="full_name"
            maxLength={120}
            autoComplete="name"
            placeholder="Ana Marić"
            className={inputClass}
          />
        </Field>
      )}

      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClass}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        hint={creating ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
      >
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={creating ? MIN_PASSWORD_LENGTH : undefined}
          autoComplete={creating ? "new-password" : "current-password"}
          className={inputClass}
        />
      </Field>

      {state.error && (
        <p className="rounded-xl border-2 border-pepper bg-butter p-3 text-[0.9375rem] font-semibold">
          {state.error}
        </p>
      )}

      <Submit creating={creating} />

      <div className="flex flex-wrap items-center justify-between gap-3 text-[0.9375rem]">
        <button
          type="button"
          onClick={() => setCreating((value) => !value)}
          className="font-semibold underline decoration-2 decoration-rind underline-offset-4 hover:decoration-pepper"
        >
          {creating ? "I already have an account" : "Create an account"}
        </button>

        {!creating && (
          <Link
            href="/login/forgot"
            className="text-crust underline decoration-2 decoration-rind underline-offset-4 hover:decoration-pepper"
          >
            Forgot password?
          </Link>
        )}
      </div>
    </form>
  );
}

function Submit({ creating }: { creating: boolean }) {
  const { pending } = useFormStatus();

  const label = pending
    ? creating
      ? "Creating…"
      : "Signing in…"
    : creating
      ? "Create account"
      : "Sign in";

  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {label}
    </Button>
  );
}
```

- [ ] **Step 2: Rewrite the login panel**

Replace the whole of `src/app/login/login-panel.tsx` with:

```tsx
"use client";

import { useState } from "react";

import { EmailForm } from "@/app/login/email-form";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";

export function LoginPanel({
  next,
  error,
  configured,
}: {
  next?: string;
  error?: string;
  configured: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(error ?? null);

  async function signInWithGoogle() {
    setPending(true);
    setFailure(null);
    try {
      const supabase = createClient();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      if (next) redirectTo.searchParams.set("next", next);

      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTo.toString() },
      });
      if (authError) throw authError;
    } catch (e) {
      setPending(false);
      setFailure(
        e instanceof Error ? e.message : "Could not start sign-in. Try again.",
      );
    }
  }

  if (!configured) {
    return (
      <div className="card p-7">
        <h2 className="text-h3">Supabase is not configured</h2>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-crust">
          Set <code className="font-mono text-[0.9375rem]">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code className="font-mono text-[0.9375rem]">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>{" "}
          and{" "}
          <code className="font-mono text-[0.9375rem]">SUPABASE_SECRET_KEY</code>{" "}
          in <code className="font-mono text-[0.9375rem]">.env.local</code>, run
          the migrations in{" "}
          <code className="font-mono text-[0.9375rem]">supabase/migrations</code>
          , then enable the Email and Google providers in Supabase Auth.
        </p>
        <p className="mt-3 text-[0.9375rem] text-crust">
          Full steps are in the README.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-7">
      <h2 className="text-h3">Sign in</h2>
      <p className="mt-2 text-[0.9375rem] text-crust">
        Use an email address and password, or continue with Google.
      </p>

      <div className="mt-6">
        <EmailForm next={next} />
      </div>

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-0.5 flex-1 bg-pepper/20" />
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
          or
        </span>
        <span className="h-0.5 flex-1 bg-pepper/20" />
      </div>

      <Button
        onClick={signInWithGoogle}
        disabled={pending}
        variant="secondary"
        size="lg"
        className="w-full"
      >
        {pending ? "Opening Google…" : "Continue with Google"}
      </Button>

      {failure && (
        <p className="mt-4 rounded-xl border-2 border-pepper bg-butter p-3 text-[0.9375rem]">
          {failure}
        </p>
      )}

      <p className="mt-6 text-[0.8125rem] leading-relaxed text-rind">
        By signing in you agree to the terms and the privacy notice. We never
        look at your photos, and you can delete an event and everything in it at
        any time.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Map the error code on the login page**

In `src/app/login/page.tsx`, add the import beside the existing `@/lib/env` import:

```tsx
import { loginErrorMessage } from "@/lib/auth";
```

and change the `LoginPanel` call on line 53 from:

```tsx
          <LoginPanel next={next} error={error} configured={hasSupabase} />
```

to:

```tsx
          <LoginPanel
            next={next}
            error={loginErrorMessage(error)}
            configured={hasSupabase}
          />
```

- [ ] **Step 4: Typecheck, lint, build**

```bash
npm run typecheck && npm run lint && npm run build
```

Expected: all three clean.

- [ ] **Step 5: Verify by hand**

```bash
npm run dev
```

Open `http://localhost:3000/login` and confirm:
- The email form renders above an "or" rule, with a secondary-styled "Continue with Google" below it
- "Create an account" swaps the button to "Create account" and reveals the Name field; clicking again swaps back with no error carried over
- Submitting a wrong password shows `That email and password don't match.`
- Submitting a bad address shows the address error without a network round trip failing

Stop the dev server afterwards.

- [ ] **Step 6: Commit**

```bash
git add src/app/login/email-form.tsx src/app/login/login-panel.tsx src/app/login/page.tsx
git commit -m "Offer email and password sign-in beside Google on the login page"
```

---

### Task 5: Forgot-password page

**Files:**
- Create: `src/app/login/forgot/page.tsx`
- Create: `src/app/login/forgot/forgot-form.tsx`

**Interfaces:**
- Consumes: `requestReset`, `AuthState` from `@/app/login/actions`; `SiteFooter`, `SiteHeader` from `@/components/site`; `Eyebrow` from `@/components/ui`
- Produces: a page at `/login/forgot`, linked from `EmailForm`

- [ ] **Step 1: Write the form**

Create `src/app/login/forgot/forgot-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { requestReset, type AuthState } from "@/app/login/actions";
import { Button, Field, inputClass } from "@/components/ui";

export function ForgotForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    requestReset,
    {},
  );

  if (state.notice) {
    return (
      <div className="card p-7">
        <h2 className="text-h3">Check your inbox</h2>
        <p className="mt-3 text-[0.9375rem] text-crust">{state.notice}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card space-y-5 p-7">
      <Field
        label="Email"
        htmlFor="email"
        hint="We send a link that signs you in long enough to set a new password."
      >
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClass}
        />
      </Field>

      {state.error && (
        <p className="rounded-xl border-2 border-pepper bg-butter p-3 text-[0.9375rem] font-semibold">
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Sending…" : "Send the link"}
    </Button>
  );
}
```

- [ ] **Step 2: Write the page**

Create `src/app/login/forgot/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";

import { ForgotForm } from "@/app/login/forgot/forgot-form";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Eyebrow } from "@/components/ui";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-butter">
        <div className="mx-auto max-w-md px-5 py-16 lg:py-24">
          <Eyebrow>Hosts only</Eyebrow>
          <h1 className="mt-3 text-h1">Reset your password</h1>
          <p className="mt-4 text-body text-crust">
            Type the address you signed up with and we will send a link.
          </p>

          <div className="mt-8">
            <ForgotForm />
          </div>

          <p className="mt-6 text-[0.9375rem]">
            <Link
              href="/login"
              className="font-semibold underline decoration-2 decoration-rind underline-offset-4 hover:decoration-pepper"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 3: Typecheck, lint, build**

```bash
npm run typecheck && npm run lint && npm run build
```

Expected: all three clean. If `SiteHeader`/`SiteFooter` are not the exported names, open `src/components/site.tsx` and use whatever `src/app/login/page.tsx:5` imports.

- [ ] **Step 4: Verify by hand**

```bash
npm run dev
```

Open `http://localhost:3000/login`, click **Forgot password?**, submit any address, and confirm the panel switches to "Check your inbox" with the non-committal sentence - including for an address that has no account. Stop the dev server afterwards.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/forgot
git commit -m "Add the forgot-password page"
```

---

### Task 6: Set-a-new-password page

**Files:**
- Create: `src/app/account/password/page.tsx`
- Create: `src/app/account/password/password-form.tsx`

**Interfaces:**
- Consumes: `updatePassword`, `AuthState` from `@/app/login/actions`; `getSessionUser` from `@/lib/supabase/server`; `MIN_PASSWORD_LENGTH` from `@/lib/auth`
- Produces: a page at `/account/password`, the destination `/auth/confirm` sends `type=recovery` links to

- [ ] **Step 1: Write the form**

Create `src/app/account/password/password-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updatePassword, type AuthState } from "@/app/login/actions";
import { Button, Field, inputClass } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";

export function PasswordForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    updatePassword,
    {},
  );

  return (
    <form action={formAction} className="card space-y-5 p-7">
      <Field
        label="New password"
        htmlFor="password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      >
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>

      <Field label="New password again" htmlFor="confirm">
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>

      {state.error && (
        <p className="rounded-xl border-2 border-pepper bg-butter p-3 text-[0.9375rem] font-semibold">
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Saving…" : "Save the password"}
    </Button>
  );
}
```

- [ ] **Step 2: Write the page**

Create `src/app/account/password/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PasswordForm } from "@/app/account/password/password-form";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Eyebrow } from "@/components/ui";
import { hasSupabase } from "@/lib/env";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set a new password" };

/**
 * Reached from a recovery link, which /auth/confirm has already turned into a
 * session. A host who is simply signed in can also use it to give a
 * Google-created account a password.
 */
export default async function PasswordPage() {
  if (!hasSupabase) redirect("/login");

  const user = await getSessionUser();
  if (!user) redirect("/login?error=session_expired");

  return (
    <>
      <SiteHeader />
      <main className="bg-butter">
        <div className="mx-auto max-w-md px-5 py-16 lg:py-24">
          <Eyebrow>Hosts only</Eyebrow>
          <h1 className="mt-3 text-h1">Set a new password</h1>
          <p className="mt-4 text-body text-crust">
            Signed in as {user.email}. This replaces any password on the account.
          </p>

          <div className="mt-8">
            <PasswordForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 3: Typecheck, lint, build**

```bash
npm run typecheck && npm run lint && npm run build
```

Expected: all three clean.

- [ ] **Step 4: Verify by hand**

```bash
npm run dev
```

Signed out, open `http://localhost:3000/account/password` and confirm it redirects to `/login` showing `Your session expired. Sign in again.` Signed in, confirm the form renders with the account's email address, and that two mismatched entries produce `Those two passwords do not match.` Stop the dev server afterwards.

- [ ] **Step 5: Commit**

```bash
git add src/app/account
git commit -m "Add the set-a-new-password page"
```

---

### Task 7: Configuration and documentation

The email links do not reach `/auth/confirm` until the Supabase templates are edited, so this task is what makes the feature actually work end to end.

**Files:**
- Modify: `.env.example`
- Modify: `README.md:27-35` (the Supabase setup section) and `README.md:72` (the stack table row)

**Interfaces:**
- Consumes: nothing
- Produces: nothing consumed by code

- [ ] **Step 1: Update `.env.example`**

Replace the Supabase block so it matches the variable names `src/lib/env.ts` now prefers, and add the site URL:

```bash
# The origin used to build confirmation and password-reset links.
# Must be listed under Authentication -> URL Configuration in Supabase.
NEXT_PUBLIC_SITE_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Leave every other line in the file as it is. If `NEXT_PUBLIC_SITE_URL` already appears elsewhere in the file, keep the single existing entry rather than adding a second.

- [ ] **Step 2: Update the README Supabase section**

Replace README step 3 (currently "Enable the Google provider…") with:

````markdown
3. Under **Authentication → Providers**, enable **Email**. Leave "Confirm email"
   on or off as you prefer - the sign-up action reads whether a session came
   back and either lands on the dashboard or asks the host to check their inbox.
   Enable **Google** in the same place if you want the Google button to work.

4. Under **Authentication → URL Configuration**, set the site URL to
   `http://localhost:3000` and add these to the redirect allow-list:

   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/auth/confirm
   ```

5. Under **Authentication → Emails**, point two templates at `/auth/confirm`.
   There is no generic type variable, so each template hard-codes its own:

   ```
   Confirm signup:  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
   Reset password:  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
   ```

   Without this the default templates send an OAuth-style link, which lands on
   `/auth/callback` with no code and bounces to `/login?error=missing_code`.
   The token-hash form also survives a link opened on a different device from
   the one that started the flow, which the default cannot.

   Supabase's built-in mail server allows only a few messages an hour. For real
   testing, set custom SMTP under **Project Settings → Auth** using the Resend
   key already listed in `.env.example`.
````

Renumber any following steps in that section.

- [ ] **Step 3: Update the stack table row**

On README line 72, change:

```
| Auth and database | Supabase - Postgres with Row Level Security, Google sign-in |
```

to:

```
| Auth and database | Supabase - Postgres with Row Level Security, email/password and Google sign-in |
```

- [ ] **Step 4: Verify the docs match the code**

```bash
grep -n "auth/confirm" README.md .env.example src/app/login/actions.ts src/app/auth/confirm/route.ts
```

Expected: the README lists both template URLs, `actions.ts` builds `emailRedirectTo` and `redirectTo` against `/auth/confirm`, and the route file exists.

- [ ] **Step 5: Full verification**

```bash
npm test && npm run typecheck && npm run lint && npm run build
```

Expected: all four clean.

- [ ] **Step 6: Commit**

```bash
git add README.md .env.example
git commit -m "Document email and password auth setup"
```

---

## Manual end-to-end checklist

These need a live Supabase project and cannot be automated here. Run them after Task 7, with the templates from Step 2 in place.

- [ ] **Confirmation off** (Authentication → Providers → Email → Confirm email OFF): create an account, land on `/dashboard` immediately, and confirm a row appeared in `public.profiles` with the name typed at sign-up
- [ ] **Confirmation on**: create an account, see the "Check your inbox" panel, click the emailed link, land on `/dashboard`
- [ ] Sign out, sign back in with the same address and password
- [ ] Sign in with the wrong password: `That email and password don't match.`
- [ ] Sign in with an address that has no account: the identical sentence
- [ ] Reset round trip: `/login/forgot` → email → link → `/account/password` → new password → `/dashboard` → sign out → sign in with the new password
- [ ] Request a reset for an address with no account: the same "if that address has an account" sentence
- [ ] `/dashboard` while signed out still redirects to `/login?next=/dashboard`
- [ ] The Google button still reaches `/auth/callback` and behaves exactly as it did before this work
