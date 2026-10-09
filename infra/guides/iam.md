# The IAM policy

One policy, one user. The application needs exactly this much and no more.

Storage and moderation are together because Rekognition reads the object with
these same credentials rather than a service role of its own.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BucketLevel",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::shot-and-share-application"
    },
    {
      "Sid": "ObjectLevel",
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
      "Sid": "UploadModeration",
      "Effect": "Allow",
      "Action": "rekognition:DetectModerationLabels",
      "Resource": "*",
      "Condition": {
        "StringEquals": { "aws:RequestedRegion": "eu-central-1" }
      }
    },
    {
      "Sid": "CdnPurge",
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
    }
  ]
}
```

## Why each line is there

**`ListBucket`** is granted because the retention job deletes a whole event
prefix at the end of its life. The application never uses it to read a gallery -
LIST is billed at the expensive request rate, and Postgres is the source of
truth for what exists.

**`PutObjectTagging`** is not optional. Uploads carry a `Tagging` header, and S3
refuses a tagged PutObject outright without it, so leaving it out breaks every
upload rather than just the tags. The tags are what make per-tier
[lifecycle rules](lifecycle.md) possible without separate buckets.

**`GetObject`** is also what makes moderation work. Rekognition reads the object
using these credentials, so a narrower object statement fails with an access
error that reads like a Rekognition problem and is not one.

**`DetectModerationLabels`** takes no resource ARN, which is why its resource is
`*`. The region condition is what stops these credentials calling Rekognition
somewhere else, and it is the line that turns "no photograph leaves the EU" from
a configuration habit into something enforced. See [moderation.md](moderation.md).

**`CreateInvalidation`** is what lets a deleted photograph be forgotten at the
edge. Scoped to the one distribution, and deliberately not paired with anything
that could change the distribution's configuration. Without it every purge fails
- logged, never thrown, because the object is already gone by then - and deleted
photographs stay readable from cache. See [cdn-purge.md](cdn-purge.md), and check
for `[cdn] cloudfront purge failed` after turning the CDN on.

## What is deliberately absent

**Nothing here grants bucket configuration** - CORS, lifecycle, the public access
block. Those are one-time operations you run yourself, and the application should
not be able to undo them.

**Nothing grants CloudFront configuration** either, only invalidation. The
distribution's own read access to the bucket is granted the other way round, by
a bucket policy naming the distribution as a service principal - that statement
lives in [cdn.md](cdn.md), step 5, and is not part of this user at all.

## The seam for later

[The key layout](key-layout.md) puts every object under `{owner_id}/`, which is
where a tighter boundary would go: an STS session scoped to `{owner_id}/*` would
let S3 enforce the tenant boundary itself, rather than trusting the application
to keep to it. Nothing needs it yet, and the layout is what makes it possible
without a migration.
