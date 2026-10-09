# The CDN

Applies `cloudfront-response-headers.json` and `cloudfront-viewer-request.js`.

Run from `infra/`, where the configuration files live - the `file://` paths below
are relative to it, not to this guide.

Gallery images are served from a hostname **separate from the app** -
`media.shotandshare.com` - and `NEXT_PUBLIC_MEDIA_BASE_URL` points at it. Until
that variable is set the app falls back to serving every photograph through its
own `/api/media` route, which is a Node function doing a HeadObject, a
GetObject and a stream per image. On a wall of fifty tiles that is fifty
invocations and a hundred S3 requests, under an image optimiser that is metered
as well. Two metered services in series, and the CDN removes both.

CloudFront rather than Cloudflare. AWS is not in the Cloudflare Bandwidth
Alliance, so every byte Cloudflare pulls from S3 is billed at \$0.09 per GB;
S3 to CloudFront transfer is free. Cloudflare's free plan also restricts serving
large volumes of non-HTML content, which a photo gallery is exactly.

The separate hostname is the point: switching to another CDN later is a DNS
change rather than a rewrite, and nothing in the application knows which one is
in front of it.

## Do this once

Everything below is `eu-central-1` except the certificate, which **must** be in
`us-east-1` - CloudFront only reads certificates from there, whatever region the
bucket is in.

```bash
BUCKET=shot-and-share-application
DOMAIN=media.shotandshare.com
ACCOUNT_ID=...
```

**1. Certificate, in us-east-1.** Validate it by DNS and wait for `ISSUED`.

```bash
aws acm request-certificate --region us-east-1 \
  --domain-name "$DOMAIN" --validation-method DNS
```

**2. Origin Access Control.** This is what lets the distribution read a bucket
that stays fully private - no public access block to undo, no presigning on the
read path.

```bash
aws cloudfront create-origin-access-control \
  --origin-access-control-config \
  "Name=$BUCKET-oac,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3"
```

**3. The two policies the distribution needs.**

```bash
# Adds X-Robots-Tag. Read "Two things that are easy to miss" before skipping it.
aws cloudfront create-response-headers-policy \
  --response-headers-policy-config file://cloudfront-response-headers.json

# Refuses any key that is not a gallery image. Same - read on before skipping.
# A function is created unpublished, and publish-function needs the ETag that
# create-function returned, so capture it rather than copying it by eye.
ETAG=$(aws cloudfront create-function \
  --name shot-and-share-media-guard \
  --function-config 'Comment="Gallery images only",Runtime=cloudfront-js-2.0' \
  --function-code fileb://cloudfront-viewer-request.js \
  --query ETag --output text)

aws cloudfront publish-function \
  --name shot-and-share-media-guard --if-match "$ETAG"
```

**4. The distribution.** Create it in the console or from a config file, with:

| Setting | Value |
|---|---|
| Origin | `$BUCKET.s3.eu-central-1.amazonaws.com`, S3 origin, OAC from step 2 |
| Alternate domain name | `$DOMAIN`, certificate from step 1 |
| Viewer protocol policy | Redirect HTTP to HTTPS |
| Allowed methods | GET, HEAD |
| Cache policy | `CachingOptimized` (managed, `658327ea-f89d-4fab-a63d-7e88639e58f6`) |
| Response headers policy | from step 3 |
| Function association | viewer request → `shot-and-share-media-guard` |
| Compress objects | yes |
| Price class | `PriceClass_100` while the customers are European |

**5. Let the distribution read the bucket.** Replace the ids and apply:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontReadOnly",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::shot-and-share-application/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
      }
    }
  }]
}
```

`s3:GetObject` and nothing else. The `SourceArn` condition is what stops any
other distribution, in any account, reading the bucket.

**6. DNS.** An A record for `$DOMAIN` aliased to the distribution (Route 53), or
a CNAME to `dxxxx.cloudfront.net` anywhere else. See "Behind Cloudflare" below
if the domain's DNS is there - two things bite, and one of them kills the
certificate outright.

```bash
dig +short CNAME "$DOMAIN" @1.1.1.1    # expect the cloudfront.net name
```

**7. Set the variables and rebuild.**

```
NEXT_PUBLIC_MEDIA_BASE_URL=https://media.shotandshare.com
CDN_PROVIDER=cloudfront
CDN_DISTRIBUTION_ID=E1234567890ABC
```

`NEXT_PUBLIC_` is inlined at build time, so the media URL needs a **redeploy,
not a restart**. The other two are server-side and take effect immediately -
they are the purge, and they are not optional. See [cdn-purge.md](cdn-purge.md).

**8. Add `cloudfront:CreateInvalidation`** to the application's IAM user. See
[iam.md](iam.md).

## What changes in the app when it lands

Two things switch over, both in code that is already written:

- `publicUrl()` starts returning CDN addresses instead of `/api/media/...`.
- Grid tiles stop going through the image optimiser. The stored thumbnail is
  already a ~25 KB WebP with a year-long cache header on it, so resizing it
  again spends a metered transformation to save a few kilobytes. The lightbox
  keeps the optimiser, which is where it earns its money.

## Behind Cloudflare

The domain's DNS being on Cloudflare is ordinary and fine - the distribution
still does the work - but two of its defaults get in the way.

**Cloudflare's CAA records block ACM, and the certificate fails rather than
waits.** Cloudflare adds CAA records for its own Universal SSL partners -
digicert, sectigo, letsencrypt, pki.goog, ssl.com, comodoca. CAA is a
whitelist: once any `issue` record exists, only the named authorities may issue
for that domain, and `amazon.com` is not among them. ACM goes to `FAILED` with
`CAA_ERROR` within minutes, which does not look like a DNS problem.

The fix is one record at the apex, and it is additive - the existing entries
stay, and Cloudflare keeps issuing its own certificates:

```
Type: CAA    Name: @    Tag: issue ("Only allow specific hostnames")
CA domain name: amazon.com
```

```bash
dig +short CAA shotandshare.com | grep -i amazon
```

A failed certificate cannot be revived. Delete it and request a new one; ACM
usually reissues the same validation token, so the CNAME already in DNS often
still applies.

**Every record here must be DNS only - grey cloud.** Both of them, for
different reasons:

| Record | Why it cannot be proxied |
|---|---|
| `_xxxx.media` (ACM validation) | A proxied record answers with Cloudflare's own A records instead of returning the CNAME value, so ACM never sees the token it is looking for and validation never completes |
| `media` → `dxxxx.cloudfront.net` | Proxying puts Cloudflare in front of CloudFront - two CDNs, Cloudflare terminating TLS so the ACM certificate is pointless, and a photo gallery on Cloudflare's free plan is the "disproportionate percentage of pictures" its terms forbid |

**Check for a wildcard before adding the media record.** A proxied
`*.shotandshare.com` answers for `media` too, so the hostname appears to
resolve before anything has been pointed at the distribution:

```bash
dig +short some-name-that-does-not-exist.shotandshare.com
```

Anything but an empty answer means a wildcard is catching it. Leave the
wildcard alone and add an explicit `media` record - a specific name always wins
over a wildcard, so nothing else is affected.

## Two things that are easy to miss

**The noindex header does not come with you.** `next.config.ts` sets
`X-Robots-Tag: noindex` on `/api/:path*`, which is what currently keeps
somebody's wedding photograph out of Google Images. Served from CloudFront, the
app's headers are not involved at all. That is what
`cloudfront-response-headers.json` is for, and it is the one step here whose
absence is invisible until a photograph turns up in an image search.

**OAC grants the whole bucket.** The app's own media route refuses
`archive/{id}.zip` and `videos/full/` - a 30 GB archive is the entire wedding in
one file, and full-size video stays behind an expiring signature deliberately. A
distribution with no viewer-request function serves both at a stable URL.
`cloudfront-viewer-request.js` is the edge copy of `publicImageType()`; the two
have to stay in step, and `tests/cdn.test.ts` fails if they drift. See
[key-layout.md](key-layout.md).

## Checking it worked

```bash
# Immutable cache header on the object, which is what makes the edge useful.
curl -sI "https://$DOMAIN/<owner>/<event>/photos/thumb/<id>.webp" \
  | grep -i 'cache-control\|x-robots-tag\|x-cache'

# Second request to the same URL should say Hit from cloudfront.
# An archive key should come back 403 from the function, never 200.
curl -sI "https://$DOMAIN/<owner>/<event>/archive/<event>.zip" | head -1
```

Objects uploaded **before** this change carry no `Cache-Control` - the header is
applied by the presigned policy at upload time - so they fall back to the
distribution's default TTL. Nothing is broken by that and it corrects itself as
new events arrive; a one-off `aws s3 cp --recursive --metadata-directive REPLACE
--cache-control` over the existing bucket is optional and rewrites every object.

## What it costs

CloudFront has a perpetual free tier of 1 TB out and 10M requests a month, and
the origin fetches behind it are free. Past that, European egress runs around
\$0.085 per GB - but the point of the cache is that egress stops scaling with
viewers, so a wedding whose photographs are looked at by two hundred guests
pulls each file from S3 roughly once per edge location rather than once per
guest. Check current pricing before relying on any of these numbers.

Because the origin pull is free, CloudFront can never cost more than serving the
photographs through the app does today. That is the main argument for it over a
cheaper-per-GB provider: the saving does not depend on the cache hit rate being
good.

## What CloudFront cannot do

**Guarantee that cached copies stay in the EU.** Its network is global by design
and there is no regional-only mode at any price. The privacy policy's claim that
photographs do not leave the EU is about the bucket and the moderation call,
both of which are `eu-central-1` and enforced - but an edge cache in Singapore
is a copy in Singapore. Either the wording covers it, or the CDN has to be one
that can pin its edges to Europe. Worth settling before launch rather than
after.

## Rate limits belong here too

`src/lib/ratelimit.ts` is per-instance and says so. Once there is a
distribution, an AWS WAF web ACL with a rate-based rule is the control that
works across every instance at once.
