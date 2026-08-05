# Infrastructure

Everything here is applied once, by hand or by whatever provisioning you prefer.
None of it is in the application's hot path.

## The bucket

Frankfurt (`eu-central-1`) is closest to the expected customer base and keeps the
GDPR conversation simple. It costs roughly 5 to 8 percent more than `us-east-1`,
which is worth it.

```bash
BUCKET=say-cheese-prod
REGION=eu-central-1

aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION"

# The bucket is private. Every read goes through the CDN or a presigned URL.
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-bucket-cors --bucket "$BUCKET" \
  --cors-configuration file://s3-cors.json

aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
  --lifecycle-configuration file://s3-lifecycle.json
```

## The lifecycle rules are not optional

Leaving 30 GB on S3 Standard for twelve months costs about \$8.28. Moving it to
Glacier Instant Retrieval after 30 days costs about \$2.01. That is six dollars of
margin on every single wedding, and it has to exist before the first paying
customer, not after.

Three rules are in `s3-lifecycle.json`:

| Rule | What it does | Why |
|---|---|---|
| `originals-to-glacier-ir-after-30-days` | Everything under `u/` moves to Glacier IR at 30 days | The whole retention model rests on this |
| `keep-forever-to-deep-archive` | Objects tagged `retention=forever` move to Deep Archive at 400 days | 30 GB costs about \$0.36 a year there, so a €29 one-off covers decades |
| `expire-generated-archives` | Objects tagged `kind=archive` expire at 30 days | The ZIP is derived data and can be rebuilt |

Two of them filter on **tags**, not prefixes, and that is deliberate: S3 prefix
filters are literal strings. There is no way to write `u/*/*/archive/`, so a
prefix rule intended for archives would match every photo in the bucket and
expire the lot.

### Why every key starts with `u/`

Objects are laid out `u/{owner_id}/{event_id}/…`, so that a host's whole estate
is one prefix and an event is one prefix inside it. Owner ids are unbounded, so
the constant first segment is what every rule above and the IAM policy below
have left to filter on - without it they would have to match the entire bucket.

It is also the seam for per-tenant credentials later: an STS session scoped to
`u/{owner_id}/*` would let S3 enforce the tenant boundary itself, rather than
trusting the application to keep to it.

### One gap, stated plainly

Uploads are tagged `tier=<tier>` at upload time by the presigned policy, which
costs no extra requests. The `retention=forever` tag is **not** applied
retroactively when a host buys The Cellar after the fact - re-tagging thousands
of existing objects needs an S3 Batch Operations job, which is the right tool and
is not wired up yet.

Until it is, Keep Forever still works correctly and safely: the retention job
excludes those events from expiry, so nothing is ever deleted. The only cost is
that the objects sit in Glacier IR at \$0.004 per GB-month rather than Deep
Archive at \$0.00099. On 30 GB that is about \$1.44 a year against \$0.36 - a real
but small margin leak against a €29 one-time payment, and it does not put a
single photo at risk.

## The media hostname

Serve thumbnails from a hostname that is **separate from the app** from day one,
for example `media.saycheese.app`, and point `NEXT_PUBLIC_MEDIA_BASE_URL` at it.

This matters more than it looks. AWS is not part of the Cloudflare Bandwidth
Alliance, so putting Cloudflare in front of S3 does not make egress free - every
byte Cloudflare pulls is billed at \$0.09 per GB. What Cloudflare buys is cache
hits, which turns egress from *bytes × viewers* into *bytes × a handful of edge
locations*. If that stops being enough, S3 to CloudFront transfer **is** free, and
with a separate hostname the swap is a DNS change instead of a rewrite.

Cloudflare's free plan also restricts serving large volumes of non-HTML content,
and a photo gallery is exactly that. Check the current terms before launch and
budget for a paid plan, Cloudflare Images, R2, or CloudFront.

## Budget alarms

Set them before launch, not after the first surprise.

```bash
aws budgets create-budget --account-id "$ACCOUNT_ID" --budget \
  '{"BudgetName":"say-cheese-monthly","BudgetLimit":{"Amount":"100","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}'
```

The number to watch is free-tier events: 1,000 fully maxed free events in a month
costs about \$210 with no revenue attached. That is the figure that decides
whether the free plan stays as generous as it is.

## The IAM policy

The application needs exactly this much and no more.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectTagging",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload"
      ],
      "Resource": "arn:aws:s3:::say-cheese-prod/u/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::say-cheese-prod",
      "Condition": { "StringLike": { "s3:prefix": ["u/*"] } }
    }
  ]
}
```

`ListBucket` is granted because the retention job deletes a whole event prefix at
the end of its life. The application never uses it to read a gallery - LIST is
billed at the expensive request rate, and Postgres is the source of truth for
what exists.
