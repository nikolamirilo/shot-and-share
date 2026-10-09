# CDN purge

Telling the cache to forget a photograph that has been deleted. Required by
[cdn.md](cdn.md), not optional after it.

```
CDN_PROVIDER=cloudfront
CDN_DISTRIBUTION_ID=E1234567890ABC
```

Plus `cloudfront:CreateInvalidation` on the application's IAM user - see
[iam.md](iam.md).

## Why this is not an optimisation

Stored objects carry `Cache-Control: public, max-age=31536000, immutable`. That
is correct - no key is ever rewritten, see [key-layout.md](key-layout.md) - and
it is what makes the edge worth having.

But **"never rewritten" is not "never deleted."** Without a purge, a photograph
removed by its guest, deleted by its host, or taken down on request goes on
being served from every edge that holds a copy, for up to a year.

The product promises faster than that, in writing: a reported photo is "hidden
at once", and a takedown is answered within `TAKEDOWN_RESPONSE_HOURS` (72). The
threat model fits exactly - the person asking for a takedown is by definition
someone who has seen the photograph and may still hold its URL.

**So a CDN with `CDN_PROVIDER` unset is strictly worse than no CDN:** the same
year-long window, now copied to every location that served the file.

## Where it is wired in

`src/lib/cdn/purge.ts`, called from all three delete paths:

| Path | Call | Shape |
|---|---|---|
| Guest delete, host delete, retention sweep | `lib/media/delete.ts` | `purge(keys)` - the file, its thumbnail, a clip's poster |
| Host deletes a whole event | `lib/actions/lifecycle.ts` | `purgePrefix()` - one wildcard |
| Retention hard-delete | `api/cron/retention` | `purgePrefix()` - one wildcard |

An event is one wildcard rather than three paths per photograph, which matters
on CloudFront: invalidation paths are metered past the first thousand a month,
and a wedding is a thousand paths on its own. The 1,000 free paths comfortably
cover event-level deletes; it is per-photograph deletes that meter, at \$0.005 a
path.

## It never throws

By the time a purge runs the object is already out of the bucket, so a failed
purge must not turn a successful delete into an error the caller has to unwind.
Same best-effort posture as `release()` in `src/lib/storage/quota.ts`.

It is logged loudly, though, because a purge failing at every event is an
operator problem and a silent catch is how it stays invisible for a month. Two
lines to watch for after turning the CDN on:

```
[cdn] cloudfront purge failed ...
[cdn] cloudfront purge skipped: CDN_DISTRIBUTION_ID is not set ...
```

The second is the half-configured case - a provider named with nothing to purge
against - and it says which variable it wants rather than failing obscurely.

## Purge latency, by provider

| Provider | Granularity | Latency | Cost |
|---|---|---|---|
| CloudFront | Path or wildcard path | 1-5 minutes | 1,000 paths/month free, then \$0.005/path |
| Bunny | URL, and wildcard prefix | Seconds | Free on every plan |

Both drivers are implemented. `CDN_PROVIDER=bunny` also needs `CDN_API_KEY`;
CloudFront signs with the S3 credentials the application already holds.

The exposure window is the purge latency, so this takes it from *up to a year*
down to minutes.

## What this does not cover

**A reported photo.** `api/guest/report` sets `review_state = 'reported'` and
never touches the object, so the file is still there and still fetchable by
anyone holding its URL. Hidden from the gallery is not the same as gone, and the
privacy copy saying "hidden at once" is true of the wall and not of the URL.
That is a decision to make rather than a bug to fix: either a report deletes or
moves the object, or the copy should say "hidden from the gallery".

**Vercel's image cache.** It has no per-URL purge - only a dashboard-wide flush
or a redeploy - which is why `minimumCacheTTL` in `next.config.ts` is 30 days
rather than a year. Thirty days plus a real purge at the CDN is the honest
combination, and it is affordable because grid tiles do not use the optimiser
once a CDN is configured.
