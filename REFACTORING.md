# Refactoring proposal

Analysis of `src/` (19,840 lines, 154 files). Nothing here changes behaviour —
it is about where code lives, and about cutting the comments back.

## Numbers first

| Thing | Now |
| --- | --- |
| Lines in `src/` | 19,840 |
| Comment lines | 3,946 (**20%**) |
| Block comments 5 lines or longer | 324 |
| Comments that narrate old versions of the code | 36 |
| Files over 400 lines | 8 |
| Direct `media` table queries outside the repo file | 25 |
| Files that call `reserve_storage` / `release_storage` | 8 |
| Copies of the same `release()` / `discard()` / `isDuplicate()` helpers | 7 |

## What is already good — keep it

- `lib/storage/` — driver interface with S3 and local behind it. Callers never
  ask which one they got. This is the pattern to copy elsewhere.
- `lib/api.ts` — one error type, one `handle()`, one status table.
- `lib/appearance/` — split into themes, variants, palette, resolve. Clean.
- `lib/db/media-repo.ts` — the right idea; it is just not used everywhere yet.
- `hooks/use-server-action.ts` — good single place for pending + error.

---

## 1. The upload handshake exists twice

`api/upload/presign` (355 lines) and `api/events/[id]/cover/presign` (244 lines)
are the same flow written twice: classify the file, pick the extension and MIME,
reserve quota, insert a reservation, sign the URL, roll back on failure.
Same again for `api/upload/confirm` (213) and `api/events/[id]/cover/confirm`
(178). Four routes, two flows, four copies of `release()`, two of `discard()`,
two of `isDuplicate()`.

The only real differences: who is allowed in (share token vs. session), whether
there is a poster to sign, and `source = 'guest' | 'cover'`.

**Proposal — one upload service, two thin routes.**

```
lib/uploads/
  reservation.ts   reserve → insert → sign, and undo it if any step fails
  confirm.ts       reservation → media row, idempotent, releases what did not arrive
  classify.ts      file descriptor → { kind, ext, format, mime, bytes }
  schema.ts        the zod shapes both routes share
```

Routes become: check who you are, call the service, return the result. Roughly
750 lines of route code drops to about 300, and the rollback logic is written
once instead of four times.

- *Single responsibility* — routes do transport, the service does the flow.
- *Open/closed* — a third upload source (host video? logo?) is a new caller,
  not a fifth copy.

## 2. Quota bookkeeping is spread over 8 files

`reserve_storage` and `release_storage` are called from routes, from a server
action, from the cron job and from the transcode worker endpoint. Every caller
writes its own try/catch and its own log line. The rule "delete the objects,
mark the row, release the bytes, clear the cover if it pointed there" is
written out separately in `lib/actions/media.ts`, `api/guest/delete` and
`api/cron/retention`.

**Proposal — `lib/storage/quota.ts` and `lib/media/delete.ts`.**

```ts
// quota.ts
reserve(eventId, bytes): Promise<boolean>
release(eventId, bytes): Promise<void>   // best effort, logs, never throws
adjust(eventId, delta): Promise<boolean> // transcode's +/- case

// delete.ts
deleteMediaRows(rows, eventId): Promise<{ removed: number; bytes: number }>
```

One place decides what "give the bytes back" means. Today a caller that forgets
the `release` leaks a host's quota silently until the nightly sweep.

## 3. `media-repo.ts` is bypassed 25 times

The repo file exists and explains why it exists — then the dashboard page,
the archive route, the slideshow page, the guest page and the delete routes all
write the same `.eq("status","ready").eq("source","guest")` chain inline again.
The dashboard page even repeats the comment about migration 0013.

**Proposal — finish the job.**

Add the four missing queries to `media-repo.ts` and route every caller through it:

```
listGuestMedia(client, eventId, limit)
listCoverMedia(client, eventId)
findMediaForGuest(client, { id, eventId, fingerprint })
listPendingProcessing(client, limit)
```

Then no page or route builds a media query by hand. Add the same for events:
`lib/db/event-repo.ts`, since `.from("events")` appears in 13 files.

- *Dependency inversion* — pages depend on named queries, not on table shape.

## 4. Pages and routes carry business logic

`app/dashboard/events/[id]/page.tsx` (315 lines) fetches the event, runs four
parallel queries, computes counts, maps rows to views, resolves the tier, builds
the share URL — and then renders five tabs.

**Proposal — a loader per page.**

```
app/dashboard/events/[id]/page.tsx     ← layout and tabs only
lib/views/event-console.ts             ← loadEventConsole(id) → one typed object
```

Same for `app/e/[token]/page.tsx` and the slideshow page. The page becomes
readable in one screen, and the loader is testable without React.

## 5. Guest access rules are re-typed per route

`resolveGuestToken` → `gateGuest` → `gallery_visible` is spelled out inline in
`api/gallery` and `api/photo`, while `requireGuestEvent` in `lib/events.ts`
does the first two but not the third. Three routes, three slightly different
answers to "may this person see this".

**Proposal — one guard file, three named guards.**

```
lib/guards/guest.ts
  requireGuestEvent(token)          // link works, event open
  requireVisibleGallery(token)      // the above + gallery not private
```

Also split `lib/events.ts` (205 lines) — it currently holds token resolution,
gate logic, media view mapping, storage summary and share-token decryption.
Move `toMediaView` to `lib/media/view.ts`, the guards to `lib/guards/guest.ts`,
leave the event lookups behind.

## 6. Three components are doing four jobs each

| File | Lines | Doing |
| --- | --- | --- |
| `upload/uploader.tsx` | 568 | queue state, presign/upload/confirm calls, retry, error copy, layout |
| `dashboard/appearance/cover-picker.tsx` | 538 | paging, upload flow, delete, dialog, tiles |
| `gallery/photo-gallery.tsx` | 578 | four layouts, load-queue, masonry columns, tile |

**Proposal — pull the logic into hooks, leave the markup.**

```
upload/use-upload-queue.ts      ← items, phases, gates, retry  (~200 lines)
upload/upload-client.ts         ← presign → send → confirm for one file
upload/uploader.tsx             ← markup only (~180 lines)

appearance/use-cover-photos.ts  ← paging + dedupe
appearance/use-cover-upload.ts  ← the upload flow (shares upload-client above)
appearance/cover-dialog.tsx     ← the dialog markup

gallery/use-load-queue.ts       ← already a hook, move it out
gallery/layouts/{grid,masonry,stack,holes}.tsx
gallery/tile.tsx
```

The cover picker and the uploader would then share one upload client instead of
each having their own copy of presign → send → confirm → rollback.

## 7. `ui/tabs.tsx` (448 lines) has too many switches

One component takes `desktop`, `mobile`, `variant`, `sticky`, `stickyOffset`,
`raised` — and the class list branches on all of them at once. About 150 of its
lines are `cx()` conditions.

**Proposal — split the styling out.**

```
ui/tabs/tabs.tsx           state, keyboard, aria (~150 lines)
ui/tabs/tab-styles.ts      the class tables, keyed by variant (~120 lines)
ui/tabs/tab-panel.tsx
```

The behaviour is fine — it is the styling matrix that should not be inline.

## 8. Comments: cut ~2,500 of 3,946 lines

The codebase is 20% comments. Most explain design history rather than the code.

**Keep** (rough target: 1,200–1,400 lines)
- Why something non-obvious is done: `qr.ts` WinAnsi stripping, `client/upload.ts`
  `randomUUID` missing over plain HTTP, S3 requiring the file field last.
- Security notes: why cover confirm checks for a null fingerprint, why the
  transcode worker never picks its own output key, the three-segment rule in
  `publicImageType`.
- Ordering constraints: delete the old object *after* the row update.
- Short doc lines on exported functions and non-obvious props.

**Delete**
- History: "This used to be…", "The old answer was…", "Before this the guest…"
  (36 occurrences). Git has this.
- Design essays. `qr.ts` has ~35 lines about why the card looks the way it does;
  `photo-gallery.tsx` has ~40 about masonry column dealing; `tabs.tsx` has ~90
  about button shapes. Three or four lines each is enough.
- Restating the code: `/** Guest photographs at one event, newest first. */`
  above `guestMedia()` is fine — the paragraph under it is not.
- Most of the 82 JSX comment blocks. Layout choices belong in a design note, not
  between two `<div>`s.

**Rule to apply going forward:** a comment answers *why*, in 1–3 lines. Anything
longer goes in `README.md` (note: `docs/` is gitignored in this repo).

---

## Suggested order

| # | Step | Risk | Payoff |
| --- | --- | --- | --- |
| 1 | Comment cut across `src/` | none | −2,500 lines, files readable |
| 2 | `quota.ts` + `delete.ts` | low | fixes the leak-by-omission class of bug |
| 3 | Finish `media-repo`, add `event-repo` | low | 25 hand-written queries → 0 |
| 4 | Guest guards + split `lib/events.ts` | low | one answer to "may they see this" |
| 5 | Upload service, four routes shrink | medium | −450 lines, one rollback path |
| 6 | Page loaders | low | pages become layout only |
| 7 | Split the three big components | medium | uploader and picker share one client |
| 8 | Split `tabs.tsx` | low | styling out of the component |

Steps 1–4 are safe and can go in one pass. Step 5 is the one that needs the
existing tests watched closely — `upload-presign`, `upload-confirm`,
`cover-upload` and `upload-roundtrip` all cover it, which is why it is doable.

## Rough end state

```
src/lib/
  api.ts                 unchanged
  guards/                guest.ts, host.ts, rate-limit.ts
  db/                    media-repo.ts, event-repo.ts, types.ts
  uploads/               classify.ts, reservation.ts, confirm.ts, schema.ts
  media/                 keys.ts, view.ts, delete.ts, formats.ts
  storage/               unchanged + quota.ts
  views/                 one loader per page
  appearance/            unchanged
```

Expected: `src/` from ~19,800 lines to ~16,000, with the drop split roughly
2,500 comments and 1,300 duplicated logic.

## Not changing

- The storage driver interface — it is the best-factored part of the codebase.
- The reservation-then-confirm upload model. It is the right design; only its
  implementation is duplicated.
- Public URLs, table shapes, migrations. No behaviour change anywhere.
