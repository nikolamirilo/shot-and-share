-- Events point at a Lemon Squeezy variant, not at a word we chose.
--
-- `events.tier` used to hold 'free' | 'event' | 'wedding' - values that were
-- both the id and the name, so 'event' named the tier of an event and renaming
-- a plan meant rewriting rows. It now holds the variant id the plan is sold
-- under, and the display name lives only in `src/lib/tiers.ts`.
--
-- Two consequences worth stating plainly, both accepted deliberately:
--
--   * The check constraint goes. Valid values now come from Lemon Squeezy at
--     runtime, so there is no list Postgres could be given.
--   * A development database and production hold different values for the same
--     plan, because a test store issues different variant ids than a live one.
--     `getTier()` falls back to Free for an id it does not recognise, which is
--     the only safe direction to be wrong in.
--
-- ---------------------------------------------------------------------------
-- BEFORE RUNNING: replace the two ids below.
--
-- Lemon Squeezy dashboard -> Products -> the product -> the variant. The id is
-- the number in the URL. They must match NEXT_PUBLIC_LS_VARIANT_PLUS and
-- NEXT_PUBLIC_LS_VARIANT_PRO, or every existing row resolves to Free.
--
-- Leaving them as-is is safe but pointless: the update matches nothing and the
-- old rows keep values the application no longer recognises.
-- ---------------------------------------------------------------------------

alter table public.events drop constraint if exists events_tier_check;

do $$
declare
  plus_variant text := 'REPLACE_ME_PLUS_VARIANT_ID';
  pro_variant  text := 'REPLACE_ME_PRO_VARIANT_ID';
begin
  if plus_variant like 'REPLACE_ME%' or pro_variant like 'REPLACE_ME%' then
    raise warning
      'Tier variant ids were not filled in. Existing paid events keep their old tier values and will resolve to Free.';
    return;
  end if;

  update public.events set tier = plus_variant where tier = 'event';
  update public.events set tier = pro_variant  where tier = 'wedding';
end $$;

-- Free is not sold, so it has no variant and keeps the literal it always had.
-- The column default already writes it.

-- Purchases record what was bought, and a product travels as a plan key rather
-- than a variant id: it has to survive changing stores. Only the two paid plans
-- were renamed; the add-on key is unchanged.
alter table public.purchases drop constraint if exists purchases_product_check;

update public.purchases set product = 'plus' where product = 'event';
update public.purchases set product = 'pro'  where product = 'wedding';

alter table public.purchases
  add constraint purchases_product_check
  check (product in ('plus', 'pro', 'keep_forever'));
