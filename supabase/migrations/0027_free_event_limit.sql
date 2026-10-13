-- ---------------------------------------------------------------------------
-- Free holds one event per account, enforced in the database.
--
-- `createEvent` counts first and refuses with a sentence a host can act on, so
-- this trigger is not what people meet. It is here because the browser holds
-- the anon key and the insert policy from 0007 accepts any row whose owner_id
-- is the signed-in user, which means a second free event is one API call away
-- from anybody who opens devtools.
--
-- Two deliberate narrowings:
--
--   * Insert only. `recomputeEntitlement` writes `tier` back to 'free' when a
--     plan is refunded, and an account already holding a free event would
--     otherwise have that refund blocked by this check.
--   * Only rows landing on 'free' are counted. A plan is bought per event, so
--     a paid event costs its owner nothing here and a host can run as many of
--     those at once as they pay for.
--
-- The one-row check below is MAX_FREE_EVENTS = 1 in src/lib/tiers.ts spelled in
-- SQL. Raising that constant means counting here instead, and rewording the
-- copy the constant's comment lists.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_free_event_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tier = 'free' and exists (
    select 1
      from public.events
     where owner_id = new.owner_id
       and tier = 'free'
  ) then
    -- The message is matched in `createEvent`, which turns it into copy.
    raise exception 'free_event_limit_reached' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- events_owner_idx is on (owner_id, created_at desc), so the lookup above is an
-- index scan over one account's rows.
drop trigger if exists events_free_limit on public.events;
create trigger events_free_limit
  before insert on public.events
  for each row execute function public.enforce_free_event_limit();
