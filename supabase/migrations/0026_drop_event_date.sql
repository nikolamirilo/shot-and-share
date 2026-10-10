-- ---------------------------------------------------------------------------
-- The date of the event comes off the event.
--
-- A host had to answer "when is it?" before they could create anything, and
-- the answer bought two things: an eyebrow above the name on the cover, the
-- card and the share preview, and the day the storage window was counted from.
--
-- The first was decoration. A guest who has just scanned a code on a table at
-- the party knows what day it is, and a host re-sharing the link in a group
-- chat is not reminding anybody either. The second is the reason this is a
-- migration rather than a few deleted lines of JSX.
--
-- Retention now counts from `retention_from`, which nobody types. It is set
-- when the event is created, and a purchase moves it forward to the day the
-- money arrived - so a plan still delivers its full window no matter how long
-- the event sat on Free first. See `recomputeEntitlement`.
--
-- The column is backfilled from `event_date` rather than from `created_at`,
-- and that is the whole care in this file. Every event that exists was given a
-- window counted from its own date; an event created in January for a wedding
-- in December holds an expiry in the following December. Anchoring those rows
-- on their creation date instead would take eleven months off somebody's
-- wedding photographs the next time anything recomputed them. `expires_at` is
-- deliberately left exactly as it is for the same reason - no row's window
-- moves today.
--
-- Per 0009 and 0015, a column drop has to go looking for the function bodies
-- that name it, because Postgres does not record them as dependencies:
--
--   select p.proname
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.prosrc ~ 'event_date';
--
-- That returns nothing. event_stats and event_media_count read the media
-- table, and no index or constraint names the column either - the events
-- indexes are on owner_id/created_at, expires_at and deleted_at.
-- ---------------------------------------------------------------------------

-- Nullable first, so the backfill decides every existing row's value rather
-- than the default quietly stamping now() over it.
alter table public.events
  add column if not exists retention_from timestamptz;

-- Midnight UTC of the event's own day, which is the instant the application
-- was already using: `new Date("2026-06-20")` parses as UTC midnight, so the
-- expiry dates this reproduces are the ones already stored.
--
-- Inside a DO block so the whole file survives being applied twice. Every
-- other statement here already says `if exists`; this one names a column the
-- last statement drops, and plain SQL would fail parsing it on a second run
-- rather than skipping it. A half-applied backfill is the worst outcome
-- available in this file, so it is the statement that gets the guard.
do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'events'
       and column_name = 'event_date'
  ) then
    update public.events
       set retention_from = (event_date::timestamp at time zone 'UTC')
     where retention_from is null;
  end if;
end $$;

alter table public.events
  alter column retention_from set default now(),
  alter column retention_from set not null;

comment on column public.events.retention_from is
  'The day the storage window is counted from. Set at creation and moved forward by a purchase to the day it was paid; never typed by a host. Backfilled from the withdrawn event_date so no existing window moved.';

alter table public.events drop column if exists event_date;
