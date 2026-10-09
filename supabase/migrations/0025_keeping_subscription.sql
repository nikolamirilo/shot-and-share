-- ---------------------------------------------------------------------------
-- Keeping the photos becomes a yearly subscription.
--
-- This replaces "Keep Forever", a €29 one-off that promised permanent storage.
-- The reason is storage rather than pricing: the only way to fund "forever"
-- from a single payment was the lifecycle rule that pushed those objects into
-- Deep Archive at 400 days, where reading one takes 12 to 48 hours and needs a
-- restore flow this product does not have. A gallery that cannot be opened is
-- not a gallery that was kept.
--
-- Files now stay on Glacier Instant Retrieval, which opens in milliseconds, and
-- the yearly fee is what pays for that - €5 on Plus, €9 on Pro.
--
-- Two things this migration deliberately does NOT do:
--
--   * It does not drop `events.keep_forever`. Anybody who bought one was
--     promised permanent storage and keeps it: `recomputeEntitlement` reads the
--     column and leaves `expires_at` null for those events. Dropping it would
--     silently convert a promise into a 12-month window.
--   * It does not convert existing Keep Forever purchases into subscriptions.
--     They paid once for permanent; billing them yearly for what they already
--     own would be the same broken promise with an invoice attached.
-- ---------------------------------------------------------------------------

-- The product column has to accept the two new subscriptions, and has to keep
-- accepting the withdrawn one so historical rows stay readable.
alter table public.purchases
  drop constraint if exists purchases_product_check;

alter table public.purchases
  add constraint purchases_product_check
  check (
    product in (
      -- On sale.
      'plus', 'pro', 'keeping_plus', 'keeping_pro',
      -- Withdrawn, and still honoured where a row has it. See above.
      'keep_forever'
    )
  );

-- The pre-cutover keys ('event', 'wedding') are deliberately absent: migration
-- 0017 already narrowed this constraint to exclude them, so a row holding one
-- could not exist without having failed that migration.

-- A renewal is looked up by the subscription that paid for it, because the
-- webhook for year two need not carry the metadata year one's checkout did.
create index if not exists purchases_subscription_idx
  on public.purchases (subscription_id)
  where subscription_id is not null;

-- Counting keeping years per event happens on every console load and on every
-- webhook, so it gets the same treatment as the other hot read.
create index if not exists purchases_event_paid_idx
  on public.purchases (event_id, product)
  where status = 'paid';

comment on column public.events.keep_forever is
  'Legacy. The withdrawn Keep Forever one-off. Read and honoured - these events never expire - but nothing sets it any more; keeping is a yearly subscription recorded in purchases.';
