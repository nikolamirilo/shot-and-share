# Say Cheese

**Every photo from every guest, at any event.**

At a wedding, two hundred guests take two thousand photos. The couple sees maybe
fifty. The rest sit on phones, scattered across group chats that compress
everything into mush, or in shared albums half the guests never join because they
have the wrong account type.

Say Cheese closes that gap. The host creates an event and gets a link and a QR
code. Guests scan it, upload from their phone, and never sign in to anything. The
host keeps the files.

---

## Running it

```bash
npm install
cp .env.example .env.local     # fill in Supabase; the rest has dev defaults
npm run dev
```

The landing page, pricing, and legal pages work immediately. The dashboard and
guest pages need Supabase.

### Supabase

1. Create a project.
2. Run `supabase/migrations/0001_init.sql` then `0002_realtime.sql` in the SQL
   editor, in that order. **No migration tooling is wired up on purpose** —
   these are plain SQL files you apply yourself.
3. Enable the Google provider under Authentication → Providers, and add
   `http://localhost:3000/auth/callback` to the redirect allow-list.
4. Copy the project URL, the anon key, and the service role key into
   `.env.local`.

### Storage

Leave `S3_BUCKET` empty and the app writes to `./.storage` through a local driver
that mirrors the S3 contract — signed, expiring, size-limited uploads and signed
reads. Everything works end to end without an AWS account: guest upload, quota
rejection, gallery, ZIP download, retention deletion.

For real infrastructure, see [`infra/README.md`](infra/README.md). The lifecycle
rules there are not optional; they are the difference between $2 and $8 of
storage cost per wedding.

### Payments

Leave the Lemon Squeezy variables empty and `ENABLE_MOCK_CHECKOUT=1` gives you a
local checkout that grants a tier without taking money. It refuses to run in
production and goes through the same `grantPurchase` function the real webhook
uses, so it cannot drift from the code that handles actual money.

```bash
npm run dev        # development server
npm run build      # production build
npm test           # 54 unit tests
npm run typecheck
npm run lint
```

---

## How it is put together

| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router |
| Styling | Tailwind CSS v4, tokens in `globals.css` |
| Auth and database | Supabase — Postgres with Row Level Security, Google sign-in |
| File storage | S3, with a local filesystem driver for development |
| Payments | Lemon Squeezy as merchant of record |
| Email | Resend, or stdout when no key is set |

### Two decisions everything else follows from

**Files never pass through the application server.** Guests upload straight to
storage with a presigned policy, and they read media straight from storage
through a CDN. The app only ever handles JSON. This is what keeps hosting free no
matter how many photos move.

**Postgres is the source of truth for what exists.** The bucket is only where the
bytes live. The application never calls `ListObjects` to find out what is in an
event, because LIST is billed at the expensive request rate and would run on
every page load.

### The upload flow

This is the path two hundred guests hit at the same time on a Saturday night.

1. Guest opens `/e/{token}`. The token is hashed and matched against
   `event_tokens`; there is no session anywhere on the guest side.
2. The browser shrinks each photo to a 720px WebP thumbnail on a canvas. The
   phone that took the photo does the work.
3. `POST /api/upload/presign` — **the quota is checked and reserved here, before
   a single URL is issued.** Checking afterwards means the bytes are already in
   the bucket and already billable.
4. The browser POSTs original and thumbnail straight to storage, three at a time,
   with a progress bar.
5. `POST /api/upload/confirm` flips the rows from `pending` to `ready`.

A row that never gets confirmed — a phone that died halfway — stays `pending`,
and the nightly job sweeps it and hands the reserved quota back.

### Presigned POST, not PUT

A presigned PUT cannot enforce a maximum size: the signature covers the key and
the method, not the body length. A guest who ignores our numbers could push a
gigabyte into the bucket and we would find out when the bill arrived. A presigned
POST carries a `content-length-range` condition that S3 itself rejects on, so the
limit is enforced by storage rather than by our client code.

### Retention

Deletion is slow, warned about repeatedly, and reversible.

```
warn at 14, 7 and 1 days  →  expire (nothing removed)  →  14-day grace  →  delete
```

`/api/cron/retention` runs daily (see `vercel.json`) behind `CRON_SECRET`. Losing
someone's wedding photos to a scheduling bug is the failure this product cannot
survive, so the destructive step is always last and always delayed. A host can
restore, or buy The Cellar, at any point before the final arrow.

### Share tokens

Stored twice: hashed for lookup, and encrypted with AES-256-GCM so the dashboard
can render the QR code again tomorrow.

Hash-only storage is the stricter design and the wrong one here — a host who lost
the tab would have to reissue the link, invalidating every card already printed
and sitting on the tables. Encrypting keeps the property that matters, that a
stolen database dump alone yields no working links. Set `TOKEN_ENCRYPTION_KEY` in
production (`openssl rand -base64 32`); development derives one from the service
role key.

### Pricing

| Plan | Price | Storage | Kept for |
|---|---|---|---|
| **Taste** | Free | 1 GB, ~250 photos | 30 days |
| **Slice** | €19 once | 10 GB, ~2,500 photos | 6 months |
| **Wheel** | €39 once | 30 GB, ~7,500 photos | 12 months |
| **The Cellar** | €29 once | — | permanently |

The unit is gigabytes, not photo counts: a count limit punishes anyone with a
recent phone and rewards nobody, while storage is what actually costs money and
lets us look far more generous for the same spend. Nothing is a subscription —
people plan one wedding, not twelve.

Wheel stops at twelve months deliberately. If retention were unlimited, the
Cellar add-on would have no job to do.

---

## Design

The whole system comes from one observation: **a cheese hole and a camera
aperture are the same shape.** So a hole is never decoration here, it is a
viewfinder — a void you look through to see something. The slab in the hero *is*
the photo grid, and the photos live inside the holes. Every circle in the
interface is the same object at a different size: step markers, list bullets,
gallery tiles, loading states.

The risk is that cheese reads as cheap or childish, which is fatal for something
a person trusts with the only copy of their wedding photos. The safeguard is that
cheese supplies exactly two things — the palette and the hole. No cartoon mice,
no wedge illustrations, no comic lettering. Warmth from colour, seriousness from
type.

Yellow leads and near-black carries the contrast. Ember (`#E2542F`) appears once,
on the shutter light in the logo, and never in the interface.

Fonts load from Google Fonts via a stylesheet link rather than `next/font`, so a
build never depends on reaching an external host.

---

## What is deliberately not here

Out of scope for version one, named so they do not creep in: face recognition,
native apps, guest accounts, comments or likes, photo editing, multi-host access,
printed photo books.

### Known gaps

Stated plainly rather than left to be discovered:

- **The ZIP builder runs in a route handler**, streamed end to end so nothing is
  buffered, but capped by the platform's function timeout. A 30 GB wedding
  archive will outrun it and belongs in a Lambda or a small Fargate task. Moving
  it is a change of host, not of logic.
- **`retention=forever` is not applied retroactively** to objects when a host
  buys The Cellar after the event. Nothing is at risk — those events are excluded
  from expiry — but the objects sit in Glacier IR rather than Deep Archive, which
  leaks about a dollar a year per event. Fixing it needs an S3 Batch Operations
  job. See `infra/README.md`.
- **Rate limits are per instance.** The real controls belong at the CDN edge,
  where they work across every instance; what is in `lib/ratelimit.ts` is a
  second line, not a guarantee.
- **HEIC thumbnails depend on the browser.** Where `createImageBitmap` cannot
  decode a file the original still uploads and the gallery falls back. The Lambda
  fallback should be added once real upload data shows which formats actually
  fail, rather than guessed at now.
- **Legal copy is a placeholder.** It describes what the product genuinely does
  with data, which is the part that has to be true, but it needs a lawyer before
  launch.
- **The hero images are placeholders** (`public/hero/*.svg`) and must be replaced
  with licensed or original photography.
