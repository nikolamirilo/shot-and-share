# The key layout

Not a step to apply - the thing [lifecycle](lifecycle.md), [the CDN](cdn.md),
[purge](cdn-purge.md) and [IAM](iam.md) all refer to. The authority is
`src/lib/media/keys.ts`; this is why it looks the way it does.

```
{owner_id}/{event_id}/photos/full/{media_id}.{ext}
{owner_id}/{event_id}/photos/thumb/{media_id}.{ext}
{owner_id}/{event_id}/videos/full/{media_id}.{ext}
{owner_id}/{event_id}/videos/poster/{media_id}.{ext}
{owner_id}/{event_id}/archive/{event_id}.zip
```

## Owner folders at the root

Objects are laid out `{owner_id}/{event_id}/…` at the **root of the bucket**, so
that a host's whole estate is one prefix and an event is one prefix inside it.
There is deliberately no wrapper prefix above the owner folders: `aws s3 ls
s3://$BUCKET/` lists hosts and nothing else, and every path a human reads - in
the console, in a log line, in a signed URL - is one level shorter.

Nothing needs a constant first segment. The transition rule in
[lifecycle.md](lifecycle.md) wants the whole bucket anyway, and
[the IAM policy](iam.md) scopes per-owner, which is where the boundary actually
is.

That also makes it the seam for per-tenant credentials later: an STS session
scoped to `{owner_id}/*` would let S3 enforce the tenant boundary itself, rather
than trusting the application to keep to it.

**S3 has no row level security, so this layout is the tenant boundary and
application code is what keeps to it.** Migration 0008 enforces the owner prefix
a second time as a CHECK constraint, and 0016 extends it to the thumbnail.

## One object per upload

An event folder is split in two: `photos/` and `videos/`. A photo is its
compressed copy in `photos/full/` plus a small grid thumbnail in
`photos/thumb/`. A video is the clip in `videos/full/` plus a still in
`videos/poster/`, because a clip has no still of itself to show in a grid.
Uploads from before the split sit directly under the event (`full/`, `thumb/`,
`{media_id}-poster.jpg`) and are read from the key on their row, so they were
not moved.

That is a storage decision before it is anything else: three renditions of the
same picture was three times the bill for a difference nobody can see on a phone,
and it is the difference between a free event holding 250 photos and holding a
thousand.

The folder is `full`, not `original`. What is in it is a re-encode - for an
iPhone photo a different format entirely - and a name that contradicts its
contents is how the next person reintroduces the bug.

## Which of these may be served publicly

Only three folders, and the distinction is load-bearing:

| Folder | Public | Why |
|---|---|---|
| `photos/full/`, `photos/thumb/` | yes | The gallery and the lightbox |
| `videos/poster/` | yes | A grid needs a still of a clip |
| `videos/full/` | **no** | Behind an expiring signature - the bytes are worth it |
| `archive/` | **no** | The entire wedding in one file |

`publicImageType()` in `src/lib/media/keys.ts` is the application's answer, and
`cloudfront-viewer-request.js` is the same answer at the edge. `tests/cdn.test.ts`
asserts the two agree, because a CDN granted the whole bucket would otherwise
serve the archive at a stable URL. See [cdn.md](cdn.md).

## Every key is immutable

A key carries a media id generated seconds before the upload, and no object is
ever rewritten under it. That is what lets stored objects carry
`Cache-Control: public, max-age=31536000, immutable`, and it is why the CDN is
worth having at all.

One exception, and it is the reason `REPLACEABLE_CACHE_CONTROL` exists: the
transcode worker replaces a file in place when the format it is converting to is
the one the key already names. Those objects get a day rather than a year.

"Never rewritten" is **not** "never deleted" - see [cdn-purge.md](cdn-purge.md).
