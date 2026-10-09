# CORS

Applies `s3-cors.json`. This is the one that breaks uploads silently.

Run from `infra/`, where the configuration files live - the `file://` paths below
are relative to it, not to this guide.

`s3-cors.json` has to name every hostname the app is served from, and it has to
be reapplied when that list changes.

```bash
aws s3api put-bucket-cors --bucket "$BUCKET" \
  --cors-configuration file://s3-cors.json

# Read it back, and check the live hostname is in the list.
aws s3api get-bucket-cors --bucket "$BUCKET"
```

## The failure mode, to know by sight

Nothing in the system reports this as an error:

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

Renaming the site is what makes this bite: the rules keep pointing at the old
domain, every other page goes on working, and only the upload stops.

## The LAN origin is deliberate

`http://192.168.1.28:3000` is a development machine on the local network, and it
is there so uploads can be tested from a real phone rather than from a desktop
browser pretending to be one. Most of what makes the upload path hard - the iOS
picker, HEIC, the camera roll - only reproduces on an actual handset.

It is also the most fragile line in the file: DHCP hands out a different address
and phone testing silently stops working, with exactly the symptoms described
above. `http://192.168.1.*:3000` is the more durable form if that becomes
annoying - S3 allows one wildcard per origin - and is an acceptable trade on a
development origin, though not on a production one.

## No wildcard on the apex

`s3-cors.json` lists the preview deployments with a wildcard in the middle
(`shot-and-share-*-reactify-developers-projects.vercel.app`) and names the
production hostnames in full. That asymmetry is deliberate.

A wildcard that would match any origin is an invitation to have the upload
policy used from somebody else's page: the presigned POST is handed out by our
own endpoint, but CORS is what decides which *page* may send it. Keep the apex
and `www` written out.

## The JSON carries no comments

The AWS CLI validates this file against the API's own shape and rejects
anything it does not recognise - a `_comment` key fails the whole command with
`Unknown parameter in CORSConfiguration.CORSRules[0]`. So the explanation lives
here instead, and `tests/cdn.test.ts` fails if a comment key reappears in a file
that gets applied.

## Reads do not need it

Only uploads. A photograph loaded into an `<img>` tag needs no CORS header, so
turning the [CDN](cdn.md) on does not add a hostname to this file - the
distribution's own hostname never appears here. What belongs in `s3-cors.json`
is wherever the *app* is served from, because that is the page making the POST.
