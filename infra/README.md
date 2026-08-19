# Infrastructure

Everything here is applied once, by hand or by whatever provisioning you prefer.
None of it is in the application's hot path.

## The bucket

Frankfurt (`eu-central-1`) is closest to the expected customer base and keeps the
GDPR conversation simple. It costs roughly 5 to 8 percent more than `us-east-1`,
which is worth it.

```bash
BUCKET=shot-and-share-application
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

## CORS is the one that breaks uploads silently

`s3-cors.json` has to name every hostname the app is served from, and it has to
be reapplied when that list changes. This is the failure mode to know by sight,
because nothing in the system reports it as an error:

- `/api/upload/presign` answers **200**. Signing does not touch CORS.
- The browser refuses to send the POST, so the bucket never sees a request and
  there is nothing in the S3 logs either.
- The app gets an XHR status of `0` - no response at all, not a rejection - and
  retries twice more before giving up, which is why a failed batch takes about
  six seconds to report itself.
- The guest is told "Could not reach storage. The bucket's CORS rules may not
  allow this site." The client also logs the key and the size to the console.
- The confirm step hands the reserved quota back, so the counters stay correct
  and there is no wreckage to find afterwards.

The tell is that presign succeeds and confirm arrives seconds later with
`failed: true` and a reason, with no media row written. A rejection *by* the
bucket looks different: it comes back as a 403 with an XML body naming the
cause, is reported immediately rather than after a retry, and is not retried at
all.

```bash
aws s3api put-bucket-cors --bucket "$BUCKET" \
  --cors-configuration file://s3-cors.json

# Read it back, and check the live hostname is in the list.
aws s3api get-bucket-cors --bucket "$BUCKET"
```

Renaming the site is what makes this bite: the rules keep pointing at the old
domain, every other page goes on working, and only the upload stops.

## The lifecycle rules are not optional

Leaving 30 GB on S3 Standard for twelve months costs about \$8.28. Moving it to
Glacier Instant Retrieval after 30 days costs about \$2.01. That is six dollars of
margin on every single wedding, and it has to exist before the first paying
customer, not after.

Three rules are in `s3-lifecycle.json`:

| Rule | What it does | Why |
|---|---|---|
| `media-to-glacier-ir-after-30-days` | Everything in the bucket moves to Glacier IR at 30 days | The whole retention model rests on this |
| `keep-forever-to-deep-archive` | Objects tagged `retention=forever` move to Deep Archive at 400 days | 30 GB costs about \$0.36 a year there, so a €29 one-off covers decades |
| `expire-generated-archives` | Objects tagged `kind=archive` expire at 30 days | The ZIP is derived data and can be rebuilt |

Two of them filter on **tags**, not prefixes, and that is deliberate: S3 prefix
filters are literal strings. There is no way to write `*/*/archive/`, so a prefix
rule intended for archives would match every photo in the bucket and expire the
lot.

### The key layout

Objects are laid out `{owner_id}/{event_id}/…` at the **root of the bucket**, so
that a host's whole estate is one prefix and an event is one prefix inside it.
There is deliberately no wrapper prefix above the owner folders: `aws s3 ls
s3://$BUCKET/` lists hosts and nothing else, and every path a human reads - in
the console, in a log line, in a signed URL - is one level shorter.

Nothing needs a constant first segment. The transition rule above wants the whole
bucket anyway, and the IAM policy below scopes per-owner, which is where the
boundary actually is.

That also makes it the seam for per-tenant credentials later: an STS session
scoped to `{owner_id}/*` would let S3 enforce the tenant boundary itself, rather
than trusting the application to keep to it.

### One object per upload

An event folder holds one file per photo - the compressed copy, which is the only
copy. No original, no thumbnail, no separate display rendition. A video keeps a
second small object, `{media_id}-poster.jpg`, because a clip has no still of
itself to show in a grid.

That is a storage decision before it is anything else: three renditions of the
same picture was three times the bill for a difference nobody can see on a phone,
and it is the difference between a free event holding 250 photos and holding a
thousand.

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

Serve gallery images from a hostname that is **separate from the app** from day
one, for example `media.saycheese.app`, and point `NEXT_PUBLIC_MEDIA_BASE_URL` at
it.

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
      "Resource": "arn:aws:s3:::shot-and-share-application/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::shot-and-share-application"
    }
  ]
}
```

`ListBucket` is granted because the retention job deletes a whole event prefix at
the end of its life. The application never uses it to read a gallery - LIST is
billed at the expensive request rate, and Postgres is the source of truth for
what exists.

## Upload moderation

Every photo is screened as it arrives, before it is visible in any gallery. The
driver is chosen by `MODERATION_PROVIDER`; leave it blank and nothing is
screened, which is the state every laptop and preview deployment runs in.

`MODERATION_PROVIDER=rekognition` uses Amazon Rekognition against the object
already sitting in the bucket, so nothing leaves the region and the call is a
key rather than an upload.

The IAM user the app already uses for S3 needs one more permission. Without it
every call fails, and because the upload path fails open, every photo goes
through unscreened and `moderated_at` stays null. That is deliberate - an AWS
outage must not stop a wedding - but it also means a missing permission is
silent apart from the logs. Check for `[moderation] rekognition failed` after
turning it on.

```bash
aws iam put-user-policy --user-name shot-and-share-application \
  --policy-name shot-and-share-moderation \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "rekognition:DetectModerationLabels",
      "Resource": "*"
    }]
  }'
```

`DetectModerationLabels` takes no resource ARN, which is why `Resource` is `*`.
Reading the object is covered by the `s3:GetObject` grant the app already holds.

Rekognition has to be available in the bucket's region. `eu-central-1` has it.
Moving the bucket to a region that does not would leave uploads unscreened
rather than broken, for the same fail-open reason.

Cost is roughly $1 per 1,000 images, so a 300-photo wedding is about 30 cents.
Video is screened on its poster frame rather than through the video API, which
is a different order of money.
