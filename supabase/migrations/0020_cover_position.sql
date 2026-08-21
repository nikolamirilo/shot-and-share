-- ---------------------------------------------------------------------------
-- Where the name sits on the cover photograph.
--
-- The cover variant answers how much of the phone the photograph gets. It has
-- never answered where the type goes on it: all three photo covers laid the
-- name across the foot, which is where the people in the photograph are.
--
-- The default is the position every event already has, so this column changes
-- nothing about any page until a host opens the panel and moves it.
--
-- The first hyphenated ids in the schema. Every other variant column holds one
-- word because every other choice is one thing; these are a vertical and an
-- alignment, and 'bottomleft' is not a word either.
-- ---------------------------------------------------------------------------

alter table public.events
  add column if not exists cover_position text not null default 'bottom-left';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_cover_position_check'
  ) then
    alter table public.events
      add constraint events_cover_position_check
      check (cover_position in ('bottom-left', 'bottom-centre', 'centre', 'top-left'));
  end if;
end
$$;

comment on column public.events.cover_position is
  'Where the name, date and message sit over the cover photo. Ignored by the "type" cover, which has no photo.';
