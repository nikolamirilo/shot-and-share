-- ---------------------------------------------------------------------------
-- Lemon Squeezy -> Creem
--
-- `events.tier` holds the payment provider's own id for the plan, so changing
-- provider changes what is in the column. Rows written under Lemon Squeezy hold
-- a numeric variant id; rows written from now on hold a Creem product id
-- (`prod_...`). Nothing else about the shape changes.
--
-- Leaving a row alone is safe but expensive: `getTier()` answers an id it does
-- not recognise with Free, so an unconverted paid event quietly loses its
-- quota, its retention window and its features until somebody notices. Every
-- paid row has to be moved.
--
-- Purchases are untouched on purpose. `purchases.product` holds a plan key
-- ('plus', 'pro', 'keep_forever'), which is exactly why it was stored that way:
-- it survives changing provider. `purchases.provider` records which provider
-- took the money and stays 'lemonsqueezy' on any historical row, because that
-- is what happened.
--
-- Nothing revokes a Lemon Squeezy order any more - that route is gone, and the
-- Creem handler passes provider 'creem', which never matches a 'lemonsqueezy'
-- row. That is accepted: nothing was ever sold through Lemon Squeezy, so there
-- is no order left that could be refunded or charged back. The updates below
-- are insurance against that being wrong, and cost nothing if it is right.
--
-- ---------------------------------------------------------------------------
-- BEFORE RUNNING: replace the four ids below.
--
-- Creem dashboard -> Products -> the product. The id is the `prod_...` string.
-- The three Creem ids must match NEXT_PUBLIC_CREEM_PRODUCT_PLUS,
-- NEXT_PUBLIC_CREEM_PRODUCT_PRO and NEXT_PUBLIC_CREEM_PRODUCT_KEEP_FOREVER, and
-- the two Lemon Squeezy ids must match what NEXT_PUBLIC_LS_VARIANT_PLUS and
-- NEXT_PUBLIC_LS_VARIANT_PRO held before the cutover - otherwise the update
-- matches nothing.
--
-- Keep Forever is a boolean column rather than a tier, so it never appears in
-- `events.tier` and needs no row rewritten. It is listed here only so the four
-- ids are checked against the dashboard in one sitting.
--
-- Leaving them as-is is safe but pointless: the update matches nothing and the
-- old rows keep values the application no longer recognises.
-- ---------------------------------------------------------------------------

do $$
declare
  ls_plus     text := 'REPLACE_ME_LS_VARIANT_PLUS';
  ls_pro      text := 'REPLACE_ME_LS_VARIANT_PRO';
  creem_plus  text := 'REPLACE_ME_CREEM_PRODUCT_PLUS';
  creem_pro   text := 'REPLACE_ME_CREEM_PRODUCT_PRO';
  moved       integer;
  stranded    integer;
begin
  if ls_plus like 'REPLACE_ME%' or ls_pro like 'REPLACE_ME%'
     or creem_plus like 'REPLACE_ME%' or creem_pro like 'REPLACE_ME%' then
    raise warning
      'Creem product ids were not filled in. Existing paid events keep their Lemon Squeezy variant ids and will resolve to Free.';
    return;
  end if;

  update public.events set tier = creem_plus where tier = ls_plus;
  get diagnostics moved = row_count;
  raise notice 'Moved % event(s) from the Lemon Squeezy Plus variant to the Creem Plus product.', moved;

  update public.events set tier = creem_pro where tier = ls_pro;
  get diagnostics moved = row_count;
  raise notice 'Moved % event(s) from the Lemon Squeezy Pro variant to the Creem Pro product.', moved;

  -- Anything left that is neither 'free' nor one of the new ids is a row this
  -- migration did not know about: a variant since replaced, or a row from a
  -- different store. It resolves to Free from here on, so say so loudly rather
  -- than let somebody discover it from a support ticket.
  select count(*) into stranded
  from public.events
  where tier not in ('free', creem_plus, creem_pro);

  if stranded > 0 then
    raise warning
      'Migration 0021: % event(s) hold a tier id that is neither free nor a Creem product. They will resolve to Free. Run: select id, tier from public.events where tier not in (%, %, %);',
      stranded, quote_literal('free'), quote_literal(creem_plus), quote_literal(creem_pro);
  end if;
end $$;

-- New rows are written by the Creem webhook and by purchase recovery. The
-- default only matters for a row inserted without one, which nothing does
-- today, but a default naming the previous provider is a trap for whoever does
-- it next.
alter table public.purchases
  alter column provider set default 'creem';

comment on column public.purchases.provider is
  'Which provider took the money: ''creem'' now, ''lemonsqueezy'' on historical rows, ''mock'' from the development checkout. A refund has to find the row under the provider that issued it.';
