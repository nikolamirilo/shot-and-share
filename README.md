# Shot & Share

**Every photo your guests take.**

At a wedding, two hundred guests take two thousand photos. The couple sees maybe
fifty. The rest sit on phones, scattered across group chats that compress
everything into mush, or in shared albums half the guests never join because they
have the wrong account type.

Shot & Share closes that gap. The host creates an event and gets a link and a QR
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
2. Run the files in `supabase/migrations/` in the SQL editor, in numerical
   order. **No migration tooling is wired up on purpose** - these are plain SQL
   files you apply yourself.
3. Under **Authentication → Providers**, enable **Email**. Leave "Confirm email"
   on or off as you prefer - the sign-up action reads whether a session came
   back and either lands on the dashboard or asks the host to check their inbox.
   Enable **Google** in the same place if you want the Google button to work.
4. Under **Authentication → URL Configuration**, set the site URL to
   `http://localhost:3000` and add both of these to the redirect allow-list:

   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/auth/confirm
   ```

5. Optional but recommended: under **Authentication → Emails**, point two
   templates at `/auth/confirm`. There is no generic type variable, so each
   template hard-codes its own:

   ```
   Confirm signup:  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
   Reset password:  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
   ```

   `/auth/confirm` accepts the stock templates too, so skipping this costs you
   one thing only: the stock link carries a code that can be exchanged solely by
   the browser that started the flow. Sign up on a laptop, open the email on a
   phone, and the stock link fails where the token-hash form above succeeds.

   Supabase's built-in mail server allows only a few messages an hour. For real
   testing, set custom SMTP under **Project Settings → Auth** using the Resend
   key already listed in `.env.example`.
6. Copy the project URL, the publishable key, and the secret key into
   `.env.local`.

### Storage

Leave `S3_BUCKET` empty and the app writes to `./.storage` through a local driver
that mirrors the S3 contract - signed, expiring, size-limited uploads and signed
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
npm test           # 125 unit tests
npm run typecheck
npm run lint
```

---

## How it is put together

| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router |
| Styling | Tailwind CSS v4, tokens in `globals.css` |
| Auth and database | Supabase - Postgres with Row Level Security, email/password and Google sign-in |
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
**Every file runs it on its own**, so uploading starts as soon as the first photo
is ready instead of waiting for the slowest one to finish compressing:

1. Guest opens `/e/{token}`. The token is hashed and matched against
   `event_tokens`; there is no session anywhere on the guest side.
2. The browser re-encodes the photo into a single compressed copy, or pulls a
   poster frame out of a video. Three at a time. See Compression below.
3. `POST /api/upload/presign` - **the quota is checked and reserved here, before
   a single URL is issued.** Checking afterwards means the bytes are already in
   the bucket and already billable. It writes a row to `upload_reservations`,
   never to `media`.
4. The browser POSTs that one file straight to storage, three uploads at a time,
   retrying a dropped connection twice. A video's poster goes up separately - it
   is cosmetic and the worker can cut another one, so it never costs the clip.
5. `POST /api/upload/confirm` writes the `media` row and deletes the
   reservation.

Compressing and uploading run behind separate concurrency gates, which is what
lets them overlap: photo six is being re-encoded while photo three is climbing
out over the network. They are different machines - the processor and the radio -
and paying for them one after the other was most of the guest's wait.

Every object lands at `{owner_id}/{event_id}/{media_id}.{ext}` - owner folders at
the root of the bucket, one file per upload. See `infra/README.md`.

**A `media` row means the bytes are in the bucket.** Nothing is written there
until the object exists, so the table needs no status filter to be read and a
failed upload is never counted against a host's quota. An upload that never
confirms - a phone that died halfway - leaves only its reservation, and the
nightly job hands the quota back and removes any orphaned object. See migration
`0010`.

### Getting the files out of the picker

Step 0, and the part that is not ours: the sheet the guest picks photos in
belongs to the operating system, and the page is frozen or discarded while it is
up. A guest who taps Add and lands back on a page where nothing happens has lost
the whole product, so `src/lib/client/picker.ts` is deliberately more careful
than the four lines this normally takes.

| What breaks | What the picker does about it |
|---|---|
| Safari cannot confirm a selection when the accept list has entries it cannot resolve - a bare `.heic`, a type it has no mapping for. Older iOS ignored them; recent iOS does not | Safari is given `image/*` (and `video/*` on a plan with video) and nothing else. Every other browser keeps the long list, which is what a desktop file manager matches extensions against |
| A file input clipped to nothing by `sr-only` is not reliably openable from script on a phone | A real 1px box at zero opacity, behind the page and out of the tab order. Nothing marks it uninteractive |
| The change event never arrives - the page was frozen, or the browser simply did not fire one | Native `change` **and** `input` listeners on the element itself, plus a sweep of the input when the page comes back into focus, twice more after a beat. Whichever arrives first wins; a selection is identified by its `FileList`, so the others are no-ops |
| Files arrive while a batch is still running and get dropped | They are held and sent as soon as the queue is free |
| The same photo picked twice does not count as a new selection | The input is cleared when the picker opens, not after the upload - so a file taken out of it is never read from an input that has been emptied |

### Compression

Photos are re-encoded **on the device that took them**, before upload. The phone
has the pixels decoded already, the guest is looking at the screen anyway, and a
4 MB photo becomes a ~1 MB upload - which on venue wifi is the difference
between a guest finishing and a guest giving up.

Measured in Chromium on a deliberately hard case (12 MP of pure noise, which is
the worst thing you can hand an encoder):

| | |
|---|---|
| Source | 6.35 MB JPEG |
| Stored | 1.56 MB WebP at 2560px |
| Saving | **75%** |
| Encode time | 829 ms |

Quality is held roughly constant by encoding to a **budget of bytes per
megapixel** rather than a fixed encoder quality. A flat quality setting gives a
plain sky and a confetti-covered dance floor wildly different file sizes; a
budget pushes the encoder harder exactly where there is more going on, which is
what "looks the same, weighs less" actually requires.

**Why not AVIF.** It beats WebP by 15–20% at these sizes, and it is still the
wrong choice here. Chromium's `canvas.toBlob` cannot encode it at all - asked
for `image/avif`, it silently returns PNG - and where encoders do exist they
take seconds per image on a phone with thirty photos queued behind it. Roughly
7% of devices also cannot decode it, so shipping AVIF as the only stored copy
breaks the promise that everyone can view and download. When the transcode
worker is deployed and encoding is off the phone, it is worth revisiting.

That silent PNG fallback is worth knowing about generally: `canvas.toBlob`
returns a blob for *any* type you ask for. Every capability probe here checks
`blob.type`, because the naive check succeeds everywhere and quietly stores the
wrong bytes under the wrong extension.

### Every device can open everything

| Situation | What happens |
|---|---|
| Normal photo | Re-encoded to WebP, or JPEG where WebP encoding is unavailable. Both open anywhere |
| HEIC from an iPhone, uploaded via Safari | Browser decodes it and stores an openable copy |
| HEIC uploaded from desktop Chrome | Browser cannot decode it. The file uploads untouched, the worker replaces it with a compressed JPEG, and the HEIC is deleted |
| Any video | Poster frame extracted in-browser immediately; the worker converts the clip to H.264/AAC MP4 with faststart |
| ZIP download | One file per photo, every one of them a format that opens on Windows as readily as on an iPhone |

HEIC is the one that actually strands people: iPhones produce it by default, it
is half the size of the equivalent JPEG, and Chrome, Firefox and Windows Photo
Viewer cannot open it.

### Video

Compressing video client-side is not attempted, and that is a deliberate
decision rather than a gap. The only browser route is MediaRecorder, which
re-encodes in **real time** - a two-minute clip takes two minutes with a guest
watching a spinner at a party. What the browser *can* usefully do is pull a
poster frame in a few hundred milliseconds, so the gallery shows the video
instead of a grey box while the rest happens elsewhere.

The clip itself goes to `workers/transcode`: ffmpeg to H.264/AAC MP4 at the
resolution it was filmed at, `+faststart` so playback begins before the download
finishes. The container and codec change so it plays everywhere; the dimensions
do not, because a 4K clip downscaled to 1080p cannot be got back and the
original is deleted once the converted copy lands.

The worker **holds no AWS credentials**. It asks the app for jobs and receives
presigned URLs for the input and each permitted output. A process running ffmpeg
over files uploaded by strangers is the most likely thing here to be
compromised, so it is given nothing worth stealing.

### One copy, always compressed

An upload keeps exactly one object: the compressed photo. There is no stored
original, no thumbnail and no separate display rendition, and there is no setting
to change that - not for the host and not for an operator.

The setting used to exist, and removing it was the point. "Keep every original
byte" filled an event four times faster to buy something nobody could see on a
screen, and it had to be chosen *before* the event, when a host had no way to
judge it. Storing three renditions of the same picture had the same shape: three
times the bill, and an event folder no human could read at a glance.

What is stored is full resolution for any screen and for printing up to A4
(2560px on the longest edge), so the gallery, the projector, the ZIP and the
lightbox all read the same file. A video keeps a second small object for its
poster frame, because a clip has no still of itself to show in a grid.

### The custom event page

What a guest sees when they scan the code. Paid plans only - it is the "custom
event page" the Plus and Pro tiers already promise.

| | Free | Plus / Pro |
|---|---|---|
| Theme | House palette | 5 presets, or pick your own colours |
| Type | House pairing | 5 pairings, heading face and body face |
| Cover | Fixed | 4 styles, using any photo from the event |
| Asking for photos | Fixed button | 4 shapes, from a big button to a slim bar |
| Gallery layout | Fixed grid | Host picks; guests may switch |
| Shot & Share header and footer | Yes | No |

The free plan's header and footer are the price of the free plan. Not a
watermark across somebody's photographs - a small bar above and an invitation
below, on the one page where the audience is a hundred people who have just
watched the product work while holding phones full of their own events.

**The gate is applied on read, not on write.** `resolveAppearance()` is the only
way to find out how an event looks, and it returns the defaults for a free event
regardless of what is in the row. Enforcing it only in the form would mean a
stale value, a downgrade, or any future code path that skips the form quietly
serves paid styling. The form rejects too, but that is for the error message,
not for the paywall.

Themes work by setting the design system's own CSS custom properties on a
wrapper element, so a theme re-skins every existing component underneath it and
**no component takes a `theme` prop**. Type works the same way: a pairing sets
`--font-display` and `--font-sans` on the same wrapper, along with the display
weight, width and tracking, because 82% width is right for Archivo - which has
a width axis - and meaningless for a serif that does not.

A guest page requests only the pairing it uses. The house pairing is already in
the root layout, so the default costs a guest nothing; the host's editor loads
all five, because switching between them is the whole point of that screen and a
font that arrives late reads as a broken preview.

**The host's preview renders the real components**, inside a real theme root -
the same `EventCover` and the same `UploadPanel` a guest gets. It used to draw
its own approximation, which is how a preview ends up disagreeing with the page:
a mock-up made of dark rectangles has no surface on it, so choosing a card
colour appeared to do nothing, and every cover style collapsed into the same
picture until a cover photo existed.

### Host colours are not trusted

A host choosing their own colours can choose pale grey text on white and hand it
to two hundred guests in a dark room. So `src/lib/color.ts` does real WCAG
contrast maths:

- Text is **corrected**, not accepted. `readableInk()` keeps the host's colour
  when it passes, pushes it to its extreme when that rescues it - dark plum
  becomes near-black rather than jumping to white - and otherwise picks whichever
  of black or white actually measures better.
- A card colour that would vanish into the background is nudged away from it.
- Every value is parsed as hex and falls back if it is not, because these end up
  in an inline `style` attribute.
- The editor shows the live contrast ratio, so the host is told rather than
  silently overridden.

An exhaustive test asserts every background/ink combination lands above 4.5:1,
and every shipped preset is checked the same way.

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
restore, or buy Keep Forever, at any point before the final arrow.

### Share tokens

Stored twice: hashed for lookup, and encrypted with AES-256-GCM so the dashboard
can render the QR code again tomorrow.

Hash-only storage is the stricter design and the wrong one here - a host who lost
the tab would have to reissue the link, invalidating every card already printed
and sitting on the tables. Encrypting keeps the property that matters, that a
stolen database dump alone yields no working links. Set `TOKEN_ENCRYPTION_KEY` in
production (`openssl rand -base64 32`); development derives one from the service
role key.

### Pricing

| Plan | Price | Storage | Kept for |
|---|---|---|---|
| **Free** | Free | 1 GB, ~150 photos | 30 days |
| **Plus** | €19 once | 10 GB, ~1,500 photos | 6 months |
| **Pro** | €39 once | 30 GB, ~4,400 photos | 12 months |
| **Keep Forever** | €29 once | - | permanently |

Photo counts assume 7 MB each, which is what a current phone shooting 24-48MP
produces once the stored copy keeps every pixel it was taken with. They are
derived from `AVG_PHOTO_BYTES`, never typed out.

The unit is gigabytes, not photo counts: a count limit punishes anyone with a
recent phone and rewards nobody, while storage is what actually costs money and
lets us look far more generous for the same spend. Nothing is a subscription -
people plan one wedding, not twelve.

Pro stops at twelve months deliberately. If retention were unlimited, the
Keep Forever add-on would have no job to do.

**A plan has two identifiers.** `key` - `free`, `plus`, `pro` - is fixed forever
and is what code says: `TIERS.pro`. `id` is the Lemon Squeezy variant the plan
is sold under, and is what `events.tier` stores. Renaming a plan is a one-line
change in `tiers.ts` because no row holds a name.

The cost of keying rows on the payment provider's id is that a test store and a
live store issue different numbers, so the same plan reads differently in a
development database than in production. `getTier()` answers an unrecognised id
with Free, which is the only safe direction to be wrong in. Variant ids are read
from `NEXT_PUBLIC_LS_VARIANT_*` rather than from `lib/env.ts`, because `tiers.ts`
is imported by client components and `env.ts` is server-only; a variant id is
already visible in every checkout URL, so there is nothing there to keep back.

---

## Design

The whole system comes from one rule: **the photographs are the colour.** An
interface holding somebody's wedding is the frame, not the picture, so the
product is a warm near-white, a near-black and two greys mixed towards the wine.
Claret (`#7A1230`) is the only saturated colour in it and it is spent on the
thing you are meant to press - the primary button, the chosen tab, the mark on a
photograph - and on nothing else. Spending it twice on a page is the limit.

The mark is a crop frame: four brackets and a shutter dot, nothing in the middle.
It is the gesture every photograph starts with, and it is the only drawn thing in
a system that is otherwise photographic. The gap in the middle is load-bearing -
at 16px the brackets read as one square, at 200px as four marks around an empty
frame, and both are the same object.

Anything a photograph goes into is a **well**: the one dark surface in a light
product, lit the way a print is - shadow along the top edge, a faint bounce off
the bottom. Every circle and tile in the interface is the same well at a
different size: step markers, list bullets, gallery tiles, loading states.

The display face is Archivo, run heavy and narrow (82% width, 800) so a headline
can be enormous without needing the whole page; body copy is Instrument Sans, and
Azeret Mono labels the machine-readable parts - tokens, short links, units.
Archivo draws its ampersand as an open, reversed-3 form, so the one in the
wordmark is borrowed from the body face and set in claret. That is a lockup, not
an accident, and it lives in `Wordmark` rather than in each caller.

Fonts load from Google Fonts via a stylesheet link rather than `next/font`, so a
build never depends on reaching an external host.

---

## Search

The marketing pages are the only part of this product a search engine should
ever see. Everything else is either behind a sign-in or is somebody's private
share link, and the whole approach follows from that.

**Two tools, two jobs, and mixing them up is the classic mistake.** A path that
must never be *indexed* has to stay crawlable, or the directive telling a
crawler to stay away is never read and the URL can still be listed as a bare
address. So `/e/` - the guest links - and `/login` are left open in robots.txt
and carry `noindex` instead: `/e/` through an `X-Robots-Tag` header set in
`next.config.ts`, which covers the JPEG behind `/api/media` as well as the HTML,
because somebody's wedding photograph turning up in an image search is the
failure that matters here. Paths that are merely private and redirect to
`/login` anyway - `/dashboard`, `/account`, `/api`, `/auth` - are disallowed in
robots.txt, to spend nobody's crawl budget on a redirect.

**Anything a crawler reads is derived from what the page reads.** `lib/seo.ts`
builds every canonical and every piece of structured data from the same
constants the interface renders: the offers in the `SoftwareApplication` schema
come from `tiers.ts`, and the `FAQPage` entries come from `lib/faqs.ts`, which is
the array the FAQ section itself maps over. Structured data that disagrees with
the page it describes is worse than none, and the only reliable way to prevent
that is to make it impossible to change one without the other.

| Route | Purpose |
|---|---|
| `/robots.txt` | `app/robots.ts`, rendered per request |
| `/sitemap.xml` | `app/sitemap.ts`, the four public pages, per request |
| `/manifest.webmanifest` | name, icon and colours for the browser chrome |
| `/opengraph-image` | 1200x630 social card, drawn not screenshotted |
| `/pricing/opengraph-image` | its own card, with the price read from `tiers.ts` |
| `/apple-icon` | the mark rendered to PNG at build, since Safari refuses SVG |

The social cards are drawn with `next/og` rather than fetching Archivo from
Google at request time. It is the same rule the font loading follows: a build,
and a card, must never depend on reaching an external host.

**`NEXT_PUBLIC_SITE_URL` has to be set at build time.** Next evaluates page
metadata when it builds, so canonicals and Open Graph URLs are frozen into the
output. `robots.txt` and `sitemap.xml` are rendered per request and correct
themselves; the pages do not. A build that did not know its own hostname ships
canonicals pointing at `localhost:3000`.

Search console ownership tokens are read from `GOOGLE_SITE_VERIFICATION` and
`BING_SITE_VERIFICATION` and are absent by design in development and on
previews.

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
  buys Keep Forever after the event. Nothing is at risk - those events are excluded
  from expiry - but the objects sit in Glacier IR rather than Deep Archive, which
  leaks about a dollar a year per event. Fixing it needs an S3 Batch Operations
  job. See `infra/README.md`.
- **Rate limits are per instance.** The real controls belong at the CDN edge,
  where they work across every instance; what is in `lib/ratelimit.ts` is a
  second line, not a guarantee.
- **The transcode worker is written but not deployed.** `workers/transcode`
  runs anywhere with ffmpeg and has a Dockerfile, but it needs a host - Fargate
  is the recommendation. Until it runs, HEIC uploaded from a non-Safari browser
  stays unviewable in the gallery and videos are served in whatever format they
  arrived in. Nothing is lost in either case: the originals are intact,
  downloadable, and in the ZIP.
- **Legal copy is a placeholder.** It describes what the product genuinely does
  with data, which is the part that has to be true, but it needs a lawyer before
  launch.
- **The hero images are placeholders** (`public/hero/*.svg`) and must be replaced
  with licensed or original photography.
