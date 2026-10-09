# Upload moderation

Amazon Rekognition, screening every photo as it arrives, before it is visible in
any gallery.

Optional. The driver is chosen by `MODERATION_PROVIDER`; leave it blank and
nothing is screened, which is the state every laptop and preview deployment runs
in.

```
MODERATION_PROVIDER=rekognition
```

`rekognition` runs against the object already sitting in the bucket, so nothing
leaves the region and the call is a key rather than an upload.

## It needs one IAM permission

`rekognition:DetectModerationLabels`, which is in [the IAM policy](iam.md).

Without it every call fails, and because the upload path **fails open**, every
photo goes through unscreened while `moderated_at` stays null. That is
deliberate - an AWS outage must not stop a wedding - but it does mean a missing
permission is silent apart from the logs. Check for
`[moderation] rekognition failed` after turning it on.

## It has to be in the bucket's region

Rekognition has to be available where the bucket is. `eu-central-1` has it.
Moving the bucket to a region that does not would leave uploads unscreened
rather than broken, for the same fail-open reason.

The region condition on the IAM statement is what keeps the call in the EU. It
is the line that turns "no photograph leaves the EU" from a habit into something
enforced, so it should not be relaxed to make a different region work - move the
provider, not the condition.

## Cost

Roughly \$1 per 1,000 images, so a 300-photo wedding is about 30 cents.

Video is screened on its poster frame rather than through the video API, which
is a different order of money.

## Two things to know about the behaviour

**The blocking list is shorter than Rekognition's taxonomy, on purpose.**
Rekognition also returns "Alcohol", "Gambling", "Rude Gestures" and "Swimwear or
Underwear", every one of which describes an ordinary wedding, stag do or pool
party. Holding those back would train hosts to approve everything without
looking, which is worse than not checking at all. The list that actually fires
is in `src/lib/moderation/rekognition.ts`.

**Video moderation depends on a worker that is not deployed.** A clip is screened
on its poster frame, and the poster is cut either by the guest's browser or by
`workers/transcode`. Where the browser could not cut one and the worker is not
running, the clip goes up unscreened. Nothing is lost - the file is intact - but
it is not screened either.
