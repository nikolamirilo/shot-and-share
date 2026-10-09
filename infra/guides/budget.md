# Budget alarms

Set them before launch, not after the first surprise.

```bash
aws budgets create-budget --account-id "$ACCOUNT_ID" --budget \
  '{"BudgetName":"shot-and-share-monthly","BudgetLimit":{"Amount":"100","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}'
```

## The number to watch

Free-tier events. 1,000 fully maxed free events in a month costs about \$210
with no revenue attached. That is the figure that decides whether the free plan
stays as generous as it is.

It is also the one cost line with no natural ceiling: a paid event is bounded by
someone having chosen to pay, and a free event is bounded only by how many
people find the product. The quota is what keeps each one small, which is why it
is reserved before a presigned URL is ever issued rather than checked afterwards.

## What the bill is actually made of

Data transfer, not storage. Transfer is the large majority of what an event
costs and storage is a small fraction of it - which is the whole argument for
[the CDN](cdn.md), and why [the lifecycle rules](lifecycle.md) matter less than
they look. Both are worth having; only one of them moves the total.

The lines worth separate alarms once there is real traffic:

| Line | Shape |
|---|---|
| CloudFront data transfer out | Scales with guests viewing galleries |
| S3 GET requests | Should stay flat once the cache warms |
| Glacier IR retrieval | Spikes on ZIP builds - see [lifecycle.md](lifecycle.md) |
| Rekognition | Linear in photos uploaded, about \$1 per 1,000 |
