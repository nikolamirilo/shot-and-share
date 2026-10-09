# The bucket

The one place the bytes live. Postgres is the source of truth for what *exists*;
this is only where the files are.

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
```

**The bucket stays private, permanently.** Nothing in the system needs it
otherwise: guests upload through a presigned POST, and reads come either through
the CDN - which is granted access as a service principal rather than by making
anything public - or through a presigned GET. If a step anywhere asks you to
undo the public access block, that step is wrong.

## Then, in order

- [CORS](cors.md) - uploads fail silently until this is applied
- [The IAM policy](iam.md) - what the application is allowed to do with it
- [Lifecycle rules](lifecycle.md) - what moves to cheap storage, and when
- [The key layout](key-layout.md) - how objects are named inside it
