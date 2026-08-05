# Email + password auth alongside Google

**Date:** 2026-08-04
**Status:** Approved, ready for implementation

## Problem

Signing in to Say Cheese is Google-only. `LoginPanel` calls
`supabase.auth.signInWithOAuth({ provider: "google" })` and there is no other way
into the product. A host without a Google account, or one whose Google sign-in
fails, has no route to a dashboard.

This design adds email + password sign-in, sign-up, and password reset through
Supabase Auth, next to the existing Google button.

## Out of scope

The broken Google sign-in is not diagnosed or changed here.
`src/app/auth/callback/route.ts` stays exactly as it is; the new email flows use
a separate route. Magic links, social providers other than Google, and
multi-factor auth are not part of this work.

## What already exists

- `src/lib/supabase/server.ts` - cookie-backed server client, plus `getSessionUser()`
- `src/lib/supabase/browser.ts` - browser client, currently used only for OAuth
- `src/app/auth/callback/route.ts` - exchanges an OAuth `?code=` for a session
- `src/middleware.ts` - refreshes the session cookie, redirects anonymous
  visitors away from `/dashboard`
- `supabase/migrations/0001_init.sql` - the `on_auth_user_created` trigger inserts
  a `public.profiles` row for every new `auth.users` row, reading `full_name` from
  `raw_user_meta_data`
- `src/lib/ratelimit.ts` - in-process per-key limiter with a `LIMITS` table
- `src/app/dashboard/actions.ts` - the house pattern for server actions: zod
  schema, `ActionState { error?, ok? }`, rate limit, redirect

## Approach

Email and password calls run in **server actions**, not in the browser.

Rejected alternatives:

- **Client-side `signInWithPassword`.** Mirrors the existing Google button and is
  the smallest diff, but every attempt is an unthrottled call straight from the
  browser, and server components do not see the new session without an explicit
  `router.refresh()`.
- **Route handlers under `/api/auth/*`.** Same behaviour as server actions with
  manual `FormData` parsing and more files. No advantage here.

Server actions keep credentials off the client, let the existing rate limiter
apply, and let the forms work without JavaScript.

## Design

### Login page shape

One panel, two ways in. `LoginPanel` keeps the Google button but demotes it below
an email/password form, separated by an "or" rule.

The form carries a **Sign in / Create account** toggle held in local component
state - no second route, so the marketing column in `src/app/login/page.tsx`
stays untouched. Create-account mode adds an optional **Name** field, passed as
`options.data.full_name` at sign-up so the existing profile trigger populates
`profiles.full_name` with no application code.

### Files

New:

| File | Purpose |
|---|---|
| `src/lib/auth.ts` | Pure zod schemas and error-message helpers, no Supabase import |
| `src/app/login/actions.ts` | `signIn`, `signUp`, `requestReset`, `updatePassword` |
| `src/app/login/email-form.tsx` | Client component; `useActionState`, mode toggle |
| `src/app/login/forgot/page.tsx` | Request a reset link |
| `src/app/account/password/page.tsx` | Set a new password; requires a session |
| `src/app/auth/confirm/route.ts` | `verifyOtp({ token_hash, type })` → session → redirect |
| `tests/auth.test.ts` | Schema and message tests |

Changed:

| File | Change |
|---|---|
| `src/app/login/login-panel.tsx` | Compose in `EmailForm`; Google becomes secondary |
| `src/lib/ratelimit.ts` | Add `signIn`, `signUp`, `passwordReset` to `LIMITS` |
| `.env.example` | Add `NEXT_PUBLIC_SITE_URL`, and the renamed Supabase key variables |
| `README.md` | Email/password setup steps and the email-template change |

Unchanged: `src/app/auth/callback/route.ts`, `src/middleware.ts` matcher.

### Sign-up works with confirmation on or off

`signUp` branches on what Supabase returns rather than on configuration:

- `data.session` present → email confirmation is disabled → `redirect(next ?? "/dashboard")`
- no session → render a "Check your inbox" state in the panel

Toggling **Confirm email** in the Supabase dashboard therefore needs no code
change in either direction.

### Why `/auth/confirm` is separate from `/auth/callback`

Supabase email links carry a `token_hash`, not an OAuth `code`. The two are
verified by different calls, and `exchangeCodeForSession` additionally fails when
a link is opened on a different device than the one that started the flow,
because the PKCE verifier lives in a cookie on the original browser. `verifyOtp`
has no such constraint.

`/auth/confirm` reads `token_hash`, `type`, and `next`:

- `type=signup` / `type=email` → verify, then redirect to `next ?? "/dashboard"`
- `type=recovery` → verify, then redirect to `/account/password`
- missing or invalid token → redirect to `/login?error=...`

`next` is validated the same way `auth/callback` validates it: it must start with
a single `/`, otherwise it falls back to `/dashboard`.

This requires editing two Supabase email templates in the dashboard. There is no
generic `{{ .Type }}` variable, so each template hard-codes its own type:

```
Confirm signup:   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
Reset password:   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
```

The destination after verification comes from `type`, not from a `next`
parameter, so the recovery template needs no extra query string. `next` is only
honoured when a caller supplies it.

`NEXT_PUBLIC_SITE_URL` is added to `.env.example` because `resetPasswordForEmail`
needs an absolute `redirectTo` origin - used as the fallback when the templates
have not been edited, and it must be allow-listed under Authentication → URL
Configuration. The current `.env` has no such variable.

### Password reset

1. `/login/forgot` posts an email address to `requestReset`
2. `requestReset` calls `resetPasswordForEmail(email, { redirectTo: <site>/auth/confirm })`
3. The emailed link hits `/auth/confirm` with `type=recovery`, which establishes a
   session and redirects to `/account/password` on the strength of the type alone
4. `/account/password` requires a session (redirects to `/login` without one) and
   calls `updateUser({ password })`

`/account/password` does **not** ask for the current password. A live session can
already delete every event in the account, so the check would guard very little,
and skipping it lets the same page serve as "set a password" for a host who
originally signed up with Google. This is a deliberate trade-off, revisit if
session theft becomes a concern.

### Validation

`src/lib/auth.ts` holds the schemas so they are testable without a Supabase
client:

- `emailSchema` - trimmed, lowercased, valid email address
- `passwordSchema` - minimum 8 characters (Supabase's own default is 6)
- `signInSchema`, `signUpSchema` (adds optional `full_name`, max 120 to match
  `profiles.full_name` usage), `resetRequestSchema`, `updatePasswordSchema`

### Errors and what they leak

- Wrong credentials → "That email and password don't match." Never "no such user."
- `requestReset` **always** returns "If that address has an account, a reset link
  is on its way," whether or not the address exists, and returns it even when
  Supabase reports an error, so the response time and text cannot be used to
  enumerate accounts.
- Sign-up for an address that already exists gets the same "Check your inbox"
  state Supabase itself produces, for the same reason.
- Unexpected Supabase errors are mapped through a helper in `src/lib/auth.ts` to
  plain sentences; raw provider strings are not rendered.

### Rate limits

Added to `LIMITS` in `src/lib/ratelimit.ts`, keyed on `clientIp(await headers())`:

| Action | Limit | Window |
|---|---|---|
| `signIn` | 10 | 5 min |
| `signUp` | 5 | 1 hour |
| `passwordReset` | 5 | 1 hour |

The module comment already notes these counters are per-instance and reset on
cold start. They are a second line of defence, not a guarantee.

### Testing

`tests/auth.test.ts` follows the existing `tests/*.test.ts` pattern - pure
functions from `src/lib/auth.ts`, no network:

- valid and invalid email addresses
- passwords under 8 characters rejected, 8+ accepted
- `full_name` optional, trimmed, and over-length rejected
- the error-mapping helper returns the non-enumerating message for Supabase's
  `invalid_credentials` error, and a generic sentence for unknown errors

Manual verification, since these paths cannot be unit-tested without a live
project: sign up with confirmation off (lands on dashboard), sign up with
confirmation on (inbox state, link signs in), sign in, wrong password, reset
round-trip, and Google sign-in still reaching `/auth/callback` unchanged.

## Risks

- **Email delivery.** Supabase's built-in SMTP is rate-limited to a few messages
  per hour. Confirmation and reset testing will be slow until `RESEND_API_KEY`
  (already in `.env.example`) is wired to Supabase's custom SMTP settings.
- **Email templates are dashboard state.** `/auth/confirm` only receives a
  `token_hash` if the templates are edited. Rather than make that a silent
  prerequisite, the route also accepts the `?code=` the stock templates produce
  and falls back to `exchangeCodeForSession`. Editing the templates is then a
  recommendation, not a requirement, and buys one thing: a link that still works
  when opened on a different device from the one that started the flow.
