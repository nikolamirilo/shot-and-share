-- ---------------------------------------------------------------------------
-- Tracing a refund back to what it paid for
--
-- A purchase row already carried the provider's transaction id, which is what
-- makes the webhook idempotent. That is not the same id a refund arrives under.
-- Lemon Squeezy sends `order_refunded` carrying the order, and without the order
-- stored against the entitlement there is nothing to match it to: the money goes
-- back and the plan stays unlocked.
--
-- Subscriptions are stored for the same reason even though nothing recurring is
-- sold today. If that ever changes, the column being there from the start is the
-- difference between handling a cancellation and discovering the column is
-- missing while somebody's card is declining.
-- ---------------------------------------------------------------------------

alter table public.purchases
  add column if not exists order_id text;

alter table public.purchases
  add column if not exists subscription_id text;

comment on column public.purchases.order_id is
  'The provider''s order id. What a refund names, which the transaction id is not.';

-- Refunds and expiries arrive by order, so this is the lookup that matters and
-- it must not be a sequential scan over every purchase ever made.
create index if not exists purchases_order_idx
  on public.purchases (provider, order_id)
  where order_id is not null;

create index if not exists purchases_subscription_idx
  on public.purchases (provider, subscription_id)
  where subscription_id is not null;

-- --- status -----------------------------------------------------------------
--
-- The column existed with a default of 'paid' and nothing ever wrote anything
-- else, because nothing handled the downgrade paths. Now that they are handled,
-- the values are worth constraining: a typo here is an entitlement that silently
-- never gets taken back.

update public.purchases set status = 'paid' where status is null;

alter table public.purchases drop constraint if exists purchases_status_check;

alter table public.purchases
  add constraint purchases_status_check
  check (status in ('paid', 'refunded', 'expired', 'failed'));

-- Finding the live entitlements for an event, which is what purchase recovery
-- and every revocation both start from.
create index if not exists purchases_event_status_idx
  on public.purchases (event_id, status);
