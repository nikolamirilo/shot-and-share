-- ---------------------------------------------------------------------------
-- Light themes, and a cover that fills the phone.
--
-- Two changes to the custom event page, both of which narrow what an event can
-- be rather than widening it:
--
--  * `full` becomes a cover variant and the new default. A guest arrives
--    holding a phone; the photograph should be the first thing on it.
--  * `framed` goes. It stacked into a small picture above a heading on a phone,
--    which is `band` without the colour - the same decision twice.
--
-- The rows have to move before the constraint does, or adding it fails on any
-- event that is still sitting on the variant being removed.
--
-- Existing events keep the cover they already have. Only `framed` is rewritten,
-- and it goes to `full` rather than to the old default, because a host who
-- picked it wanted their photograph on the page.
-- ---------------------------------------------------------------------------

update public.events
   set cover_variant = 'full'
 where cover_variant = 'framed';

alter table public.events
  drop constraint if exists events_cover_variant_check;

alter table public.events
  add constraint events_cover_variant_check
  check (cover_variant in ('full', 'classic', 'band', 'type'));

alter table public.events
  alter column cover_variant set default 'full';

-- ---------------------------------------------------------------------------
-- Themes are all light now, and 'midnight' - the one dark preset - is gone.
--
-- `theme` is unconstrained on purpose (see 0005), so an event left on it would
-- simply fall back to the house yellow when it is read. That is a working page
-- but not the one the host chose: they picked dark and gold. 'ivory' is the
-- light palette carrying the same gold, so it is where they land.
-- ---------------------------------------------------------------------------

update public.events
   set theme = 'ivory'
 where theme = 'midnight';

comment on column public.events.cover_variant is
  'Which cover layout the guest page opens with. Defaults to the full-screen photo.';
