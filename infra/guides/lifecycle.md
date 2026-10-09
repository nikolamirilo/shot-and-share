# Lifecycle rules

Applies `s3-lifecycle.json`. **Not optional.**

Run from `infra/`, where the configuration files live - the `file://` paths below
are relative to it, not to this guide.

Leaving 30 GB on S3 Standard for twelve months costs about \$8.28. Moving it to
Glacier Instant Retrieval after 30 days costs about \$2.01. That is six dollars of
margin on every single wedding, and it has to exist before the first paying
customer, not after.

```bash
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
  --lifecycle-configuration file://s3-lifecycle.json
```

## The two rules

| Rule | What it does | Why |
|---|---|---|
| `media-to-glacier-ir-after-30-days` | Everything in the bucket moves to Glacier IR at 30 days | The whole retention model rests on this |
| `expire-generated-archives` | Objects tagged `kind=archive` expire at 30 days | The ZIP is derived data and can be rebuilt |

## Why there is no Deep Archive rule

There used to be a third: objects tagged `retention=forever` moved to Deep
Archive at 400 days, which made a €29 one-off "Keep Forever" pay for itself for
decades. It has been removed, and the add-on it funded was withdrawn with it.

**Deep Archive cannot serve a gallery.** Retrieval takes 12 to 48 hours and
needs an explicit restore request per object; a plain `GET` returns
`InvalidObjectState`, not an image. So roughly thirteen months after someone
paid for permanence, their event page would start showing broken photographs -
and nothing in the application knows how to restore them. `RestoreObject`
appears nowhere in the codebase.

Worse, the thumbnails are under 128 KB and never transition, so the gallery
would still render a full wall of pictures that cannot be opened. The failure
would look like a bug rather than an archive.

It never actually fired, for an accidental reason: the `retention=forever` tag
is never written by the application, so the rule had nothing to match. Two
mistakes cancelling out - which means *fixing the tag* would have armed this.
That is the trap this file exists to document.

Keeping is a yearly subscription now (€5 on Plus, €9 on Pro), and the files stay
on Glacier IR where they open in milliseconds. 30 GB costs about €1.80 a year to
hold there, so the fee covers the storage comfortably. A gallery that cannot be
opened is not a gallery that was kept.

## Why two of them filter on tags

Two filter on **tags**, not prefixes, and that is deliberate: S3 prefix filters
are literal strings. There is no way to write `*/*/archive/`, so a prefix rule
intended for archives would match every photo in the bucket and expire the lot.

See [the key layout](key-layout.md) for why no prefix could express it.

The first rule's `"Filter": {}` is an **empty filter on purpose**, not an
oversight. There is nothing above the owner folders to filter on - objects sit
at `{owner_id}/{event_id}/…` at the root of the bucket - and an empty filter
means the whole bucket, which is exactly the intent. Every object in here is
somebody's photo.

## The JSON carries no comments

The AWS CLI validates this file against the API's own shape and rejects
anything it does not recognise - a `_comment` key fails the whole command with
`Unknown parameter in LifecycleConfiguration.Rules[0]`. So the reasoning lives
here instead, and `tests/cdn.test.ts` fails if a comment key reappears in a file
that gets applied.

## The tags

Uploads are tagged `tier=<tier>` at upload time by the presigned policy, which
costs no extra requests. That is the tag the archive-expiry rule and any future
per-tier rule filter on.

`retention=forever` is referenced by nothing now. It was never written by the
application, and the rule that read it is gone, so there is nothing left to
reconcile - and no S3 Batch Operations job needed to backfill it, which is the
one piece of work this simplification removed rather than deferred.

## Reading an object back out of Glacier IR

Glacier IR charges a per-GB retrieval fee on **every** read, plus a GET at the
Glacier IR rate. There is no free first read. Three things follow, and only one
of them is a problem.

**Browsing an old gallery is cheap.** The rule carries no size filter, and it
does not need one: S3 will not transition an object under 128 KB to Glacier IR
at all. A stored thumbnail is around 25 KB, so the files a wall of photographs
actually loads never leave Standard. A [CDN](cdn.md) cache miss on a tile is an
ordinary Standard GET.

**Opening photographs full-size is noticeable but small.** The lightbox and the
Stack layout read the full copy - roughly 350 MB for a pass through fifty
photographs, about \$0.01 of retrieval per viewer per cold pass.

**The ZIP is the one to watch.** A 30 GB Pro event is 30 GB read cold, about
\$0.90 per build, and `MAX_ARCHIVE_BUILDS` allows three - so up to \$2.70 of
retrieval against an event whose annual storage is around \$2.47. It is capped
rather than open for exactly this reason, and the archive is served by a
presigned URL rather than through the CDN, so no cache helps here.

## A known mismatch on the free tier

The 30-day transition charges a per-object fee to move an object, and Glacier IR
bills a 90-day minimum once it arrives. Free events are kept 30 days and hard
deleted after a 14-day grace period - so they transition at day 30 and are gone
by day 44, having paid the move and most of a 90-day minimum for 14 days of
cheaper storage. The saving never happens.

Small in absolute terms, and easy to fix when it matters: give free events a
later trigger, or exclude them from the transition. It needs a tag the presigned
policy already knows how to write (`tier=free` rides along with every upload).
