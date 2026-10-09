# Infrastructure

Everything here is applied once, by hand or by whatever provisioning you prefer.
None of it is in the application's hot path.

One file per thing, because these get read at different moments: the bucket and
CORS when uploads stop working, the lifecycle rules when the bill arrives, the
CDN when the gallery is slow, the IAM policy when something returns 403.

## The order to apply them in

| | What | Why in this position |
|---|---|---|
| 1 | [The bucket](guides/bucket.md) | Nothing else exists without it |
| 2 | [CORS](guides/cors.md) | Uploads fail silently until this is right |
| 3 | [The IAM policy](guides/iam.md) | The application cannot read or write without it |
| 4 | [Lifecycle rules](guides/lifecycle.md) | Six dollars of margin per wedding, and it has to exist before the first paying customer |
| 5 | [Budget alarms](guides/budget.md) | Before the first surprise, not after |
| 6 | [The CDN](guides/cdn.md) | Every photograph goes through a function until this lands |
| 7 | [CDN purge](guides/cdn-purge.md) | Required *by* step 6 - a CDN without it is worse than no CDN |
| 8 | [Upload moderation](guides/moderation.md) | Optional, and off on every laptop |

[The key layout](guides/key-layout.md) is not a step. It is the thing steps 4, 6 and 7
all refer to, and it is worth reading before any of them.

## Shared variables

Every guide assumes these, and assumes you are running from `infra/` - the
`file://` paths in them are relative to that directory, not to `guides/`.

```bash
cd infra

BUCKET=shot-and-share-application
REGION=eu-central-1
ACCOUNT_ID=...
```

## The configuration files

| File | Applied with | Explained in |
|---|---|---|
| `s3-cors.json` | `aws s3api put-bucket-cors` | [cors.md](guides/cors.md) |
| `s3-lifecycle.json` | `aws s3api put-bucket-lifecycle-configuration` | [lifecycle.md](guides/lifecycle.md) |
| `cloudfront-response-headers.json` | `aws cloudfront create-response-headers-policy` | [cdn.md](guides/cdn.md) |
| `cloudfront-viewer-request.js` | `aws cloudfront create-function` | [cdn.md](guides/cdn.md) |

## The two rules that run through all of it

**The bucket is private and stays private.** Guests upload through a presigned
POST; reads come through the CDN, which is granted access as a service principal,
or through a presigned GET. No step here should ever ask you to undo the public
access block.

**Postgres is the source of truth for what exists.** The bucket is only where
the bytes live. The application never calls `ListObjects` to find out what is in
an event - LIST is billed at the expensive request rate and would run on every
page load.

## Known gaps

Stated here rather than left to be discovered. Each is explained where it
belongs:

- The `retention=forever` tag is never applied retroactively -
  [lifecycle.md](guides/lifecycle.md)
- The 30-day Glacier transition costs money rather than saving it on free events
  - [lifecycle.md](guides/lifecycle.md)
- A *reported* photo is hidden from the gallery but still readable at its URL -
  [cdn-purge.md](guides/cdn-purge.md)
- CloudFront cannot keep cached copies inside the EU - [cdn.md](guides/cdn.md)
- Video moderation depends on a worker that is not deployed -
  [moderation.md](guides/moderation.md)
